const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real provider Jobs endpoint with isolated model/payment fakes.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let row;
let updates;
let payments;
let paymentRequests;

const Request = {
  formatRequestId: (requestNumber) => `SR-${String(requestNumber).padStart(4, '0')}`,
  listRecipientsForProvider: async () => [
    { request_id: 'request-1', provider_id: 'provider-1', status: 'accepted' },
  ],
  findByIds: async () => [row],
  findUsersByIds: async () => ({ 'customer-1': { name: 'Customer One' } }),
  listQuotationsForProvider: async () => [
    {
      request_id: 'request-1',
      provider_id: 'provider-1',
      labor_cost: 1000,
      parts_cost: 0,
      service_fee: 50,
    },
  ],
};
const Workflow = {
  listProgressUpdates: async () => updates,
  listPayments: async () => payments,
  listPaymentRequests: async () => paymentRequests,
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/models/provider_model', {});
mockModule('../src/config/supabase', { supabase: {} });
mockModule('../src/config', { paymongo: { secretKey: '', baseUrl: 'https://example.invalid' } });
mockModule('../src/utils/paymongo', {});
mockModule('../src/utils/storage', {
  getProviderFileUrl: async () => null,
  getUserPhotoUrl: async () => null,
});
mockModule('../src/utils/ai_sentiment', { analyzeSentiment: async () => 'neutral' });

const { listJobs } = require('../src/controllers/workflow_controllers');

const invokeListJobs = async () => {
  const res = {
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await listJobs({ user: { user_id: 'provider-1' } }, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return res.body.jobs[0];
};

const payment = (stage, status, amount) => ({
  request_id: 'request-1',
  payment_id: `${stage}-${status}`,
  stage,
  status,
  amount,
});
const progress = (step) => ({ request_id: 'request-1', step });

test.beforeEach(() => {
  row = {
    request_id: 'request-1',
    request_number: 1,
    customer_id: 'customer-1',
    request_status: 'In Progress',
    service_location_type: 'shop',
    category: 'Home Repair',
    created_at: '2026-11-24T08:00:00Z',
    ai_diagnosis: null,
  };
  updates = [];
  payments = [payment('initial', 'paid', 210)];
  paymentRequests = [];
});

test('provider Jobs supplies the progress state required by the mobile segment colors', async () => {
  updates = [progress('Assessing'), progress('Repairing')];

  const job = await invokeListJobs();

  assert.equal(job.started, true);
  assert.equal(job.currentStepIndex, 1);
  assert.equal(job.currentStepLabel, 'Repairing');
  assert.equal(job.status, 'Active');
});

test('a job without provider updates remains not started', async () => {
  const job = await invokeListJobs();

  assert.equal(job.started, false);
  assert.equal(job.currentStepIndex, 0);
  assert.equal(job.currentStepLabel, 'Not started');
});

test('completed repair stays Active as Pending Payment until the final balance is paid', async () => {
  row.request_status = 'Completed';
  updates = [progress('Assessing'), progress('Repairing'), progress('Quality Check'), progress('Completed')];
  payments.push(payment('final', 'pending', 840));

  const job = await invokeListJobs();

  assert.equal(job.status, 'Active');
  assert.equal(job.statusLabel, 'Pending Payment');
  assert.equal(job.isPaid, false);
  assert.equal(job.finalAmount, 840);
  assert.equal(job.started, true);
  assert.equal(job.currentStepIndex, 3);
});

test('paid final balance moves the completed repair to Completed', async () => {
  row.request_status = 'Completed';
  updates = [progress('Completed')];
  payments.push(payment('final', 'paid', 840));

  const job = await invokeListJobs();

  assert.equal(job.status, 'Done');
  assert.equal(job.statusLabel, 'Completed');
  assert.equal(job.isPaid, true);
  assert.equal(job.finalAmount, 0);
});

test('approved unpaid additional costs remain part of the final balance', async () => {
  row.request_status = 'Completed';
  updates = [progress('Completed')];
  paymentRequests = [{ request_id: 'request-1', status: 'approved', amount: 100 }];
  payments.push(payment('final', 'paid', 840));

  const job = await invokeListJobs();

  assert.equal(job.status, 'Active');
  assert.equal(job.statusLabel, 'Pending Payment');
  assert.equal(job.isPaid, false);
  assert.equal(job.finalAmount, 100);
});
