const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let paymentRequests;
let payments;
let addedPayments;
const row = {
  request_id: 'request-1', request_number: 1, customer_id: 'customer-1', provider_id: 'provider-1',
  request_status: 'In Progress', service_location_type: 'shop', category: 'Home Repair',
  created_at: '2026-11-28T08:00:00Z', ai_diagnosis: null,
};
const recipient = { request_id: 'request-1', provider_id: 'provider-1', status: 'accepted' };
const quote = { request_id: 'request-1', provider_id: 'provider-1', labor_cost: 1000, parts_cost: 0, service_fee: 50 };

const Request = {
  formatRequestId: (number) => `SR-${String(number).padStart(4, '0')}`,
  parseRequestId: (value) => /^SR-(\d+)$/i.exec(String(value))?.[1] ? 1 : null,
  findByRequestNo: async () => row,
  findByIds: async () => [row],
  listForCustomer: async () => [row],
  listRecipients: async () => [recipient],
  listQuotations: async () => [quote],
  findUsersByIds: async () => ({
    'customer-1': { name: 'Customer One' }, 'provider-1': { name: 'Provider One' },
  }),
};
const Workflow = {
  listScheduleProposals: async () => [],
  listPaymentRequests: async () => paymentRequests,
  listProgressUpdates: async () => [],
  listPayments: async () => payments,
  listActivePaymentRequests: async () => paymentRequests.filter((p) => ['pending', 'approved'].includes(p.status)),
  listNegotiatingPaymentRequests: async () => paymentRequests.filter((p) => p.negotiation_status === 'requested'),
  findPaymentRequest: async (id) => paymentRequests.find((p) => p.payment_request_id === id) || null,
  updatePaymentRequest: async (id, patch) => {
    const target = paymentRequests.find((p) => p.payment_request_id === id);
    Object.assign(target, patch);
    return target;
  },
  addPayment: async (payment) => {
    const saved = { payment_id: `payment-${addedPayments.length + 1}`, created_at: '2026-11-28T09:00:00Z', ...payment };
    addedPayments.push(saved);
    payments.push(saved);
    return saved;
  },
  notify: async () => null,
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/models/provider_model', {});
mockModule('../src/config/supabase', { supabase: {} });
mockModule('../src/config', { paymongo: { secretKey: '', baseUrl: 'https://example.invalid' }, baseUrl: 'https://example.invalid' });
mockModule('../src/utils/paymongo', {});
mockModule('../src/utils/storage', { getProviderFileUrl: async () => null, getUserPhotoUrl: async () => null });
mockModule('../src/utils/ai_sentiment', { analyzeSentiment: async () => 'neutral' });
mockModule('../src/controllers/servicerequest_controllers', { providerDistanceTo: async () => () => 1.5 });

const {
  answerPaymentRequest, deferPaymentRequest, getPaymentDue, getTracking, listJobQuotations, payForRequest,
} = require('../src/controllers/workflow_controllers');

const invoke = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let error;
  await handler({ headers: {}, query: {}, body: {}, ...req }, res, (nextError) => { error = nextError; });
  if (error) throw error;
  return res;
};

const extra = (id, status, amount, other = {}) => ({
  payment_request_id: id, request_id: 'request-1', provider_id: 'provider-1', status, amount,
  reason: `Parts ${id}`, created_at: `2026-11-28T08:0${id.slice(-1)}:00Z`, ...other,
});
const cardIds = (body) => body.approved.map((card) => card.paymentRequestId);

test.beforeEach(() => {
  paymentRequests = [
    extra('pr-1', 'approved', 100, { negotiation_status: 'accepted' }),
    extra('pr-2', 'approved', 200),
    extra('pr-3', 'approved', 300, { deferred_at: '2026-11-28T08:30:00Z' }),
    extra('pr-4', 'pending', 400),
    extra('pr-5', 'rejected', 500),
  ];
  payments = [
    { request_id: 'request-1', stage: 'initial', status: 'paid', amount: 210 },
  ];
  addedPayments = [];
  row.request_status = 'In Progress';
});

test('mobile Track retains approved requests until paid or deferred, but not during pending checkout', async () => {
  let res = await invoke(getTracking, { user: { user_id: 'customer-1' }, query: { includeAwaitingPayment: 'true' } });
  assert.deepEqual(cardIds(res.body), ['pr-1', 'pr-2', 'pr-4']);
  assert.equal(res.body.approved[0].paymentStatus, 'approved');
  assert.equal(res.body.approved[0].negotiationStatus, 'accepted');
  assert.equal(res.body.ongoing[0].deferredAdditionalAmount, 300);

  payments = [
    { request_id: 'request-1', payment_request_id: 'pr-1', stage: 'additional', status: 'paid', amount: 100 },
    { request_id: 'request-1', payment_request_id: 'pr-2', stage: 'additional', status: 'pending', amount: 200 },
  ];
  res = await invoke(getTracking, { user: { user_id: 'customer-1' }, query: { includeAwaitingPayment: 'true' } });
  assert.deepEqual(cardIds(res.body), ['pr-2', 'pr-4']);

  // Older clients keep their original pending-only response.
  res = await invoke(getTracking, { user: { user_id: 'customer-1' } });
  assert.deepEqual(cardIds(res.body), ['pr-4']);
});

test('mobile provider Jobs uses the same settlement rules as customer Track', async () => {
  const req = { user: { user_id: 'provider-1' }, query: { includePaymentRequests: 'true' } };
  let res = await invoke(listJobQuotations, req);
  assert.deepEqual(res.body.quotations.map((q) => q.paymentRequestId), ['pr-1', 'pr-2', 'pr-4']);
  assert.equal(res.body.quotations[0].statusLabel, 'Awaiting Payment');

  payments = [{ request_id: 'request-1', payment_request_id: 'pr-1', stage: 'additional', status: 'paid', amount: 100 }];
  res = await invoke(listJobQuotations, req);
  assert.deepEqual(res.body.quotations.map((q) => q.paymentRequestId), ['pr-2', 'pr-4']);
});

test('Pay Later persists deferral without changing the approved amount billed in the final balance', async () => {
  const res = await invoke(deferPaymentRequest, {
    user: { user_id: 'customer-1' },
    params: { requestId: 'SR-0001', paymentRequestId: 'pr-1' },
  });
  assert.equal(res.body.status, 'deferred');
  assert.equal(paymentRequests[0].status, 'approved');
  assert.ok(paymentRequests[0].deferred_at);

  const tracking = await invoke(getTracking, { user: { user_id: 'customer-1' }, query: { includeAwaitingPayment: 'true' } });
  assert.deepEqual(cardIds(tracking.body), ['pr-2', 'pr-4']);
  const due = await invoke(getPaymentDue, { user: { user_id: 'customer-1' }, params: { requestId: 'SR-0001' } });
  assert.equal(due.body.total, 1650); // quotation 1050 + approved extras 100 + 200 + 300
});


test('Pay Now uses and links only the selected additional request', async () => {
  const due = await invoke(getPaymentDue, {
    user: { user_id: 'customer-1' },
    params: { requestId: 'SR-0001' },
    query: { paymentRequestId: 'pr-2' },
  });
  assert.equal(due.body.due.additional, 200);

  const res = await invoke(payForRequest, {
    user: { user_id: 'customer-1' },
    params: { requestId: 'SR-0001' },
    body: { amount: 200, method: 'gcash', stage: 'additional', paymentRequestId: 'pr-2' },
  });
  assert.equal(res.body.payment.status, 'paid');
  assert.equal(addedPayments[0].payment_request_id, 'pr-2');

  const tracking = await invoke(getTracking, { user: { user_id: 'customer-1' }, query: { includeAwaitingPayment: 'true' } });
  assert.deepEqual(cardIds(tracking.body), ['pr-1', 'pr-4']);
});

test('customer additional-payment rejection still requires a nonblank reason', async () => {
  await assert.rejects(
    invoke(answerPaymentRequest('rejected'), {
      user: { user_id: 'customer-1' },
      params: { requestId: 'SR-0001', paymentRequestId: 'pr-4' },
      body: { reason: '   ' },
    }),
    (error) => error.status === 400 && /reason/i.test(error.message),
  );
  assert.equal(paymentRequests.find((p) => p.payment_request_id === 'pr-4').status, 'pending');
});

test('job completion does not hide an unsettled additional request on mobile Track', async () => {
  row.request_status = 'Completed';
  const res = await invoke(getTracking, {
    user: { user_id: 'customer-1' },
    query: { includeAwaitingPayment: 'true' },
  });
  assert.deepEqual(cardIds(res.body), ['pr-1', 'pr-2', 'pr-4']);
});


