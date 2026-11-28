const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real customer Track, provider Incoming and provider Jobs endpoints with
// isolated model/payment fakes.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let row;
let updates;
let payments;
let paymentRequests;

const recipient = { request_id: 'request-1', provider_id: 'provider-1', status: 'accepted' };
const quote = {
  request_id: 'request-1',
  provider_id: 'provider-1',
  labor_cost: 1000,
  parts_cost: 0,
  service_fee: 50,
};
const Request = {
  formatRequestId: (requestNumber) => `SR-${String(requestNumber).padStart(4, '0')}`,
  listForCustomer: async () => [row],
  listRecipients: async () => [recipient],
  listQuotations: async () => [quote],
  listRecipientsForProvider: async () => [recipient],
  findByIds: async () => [row],
  findUsersByIds: async () => ({ 'customer-1': { name: 'Customer One' } }),
  listQuotationsForProvider: async () => [quote],
};
const Workflow = {
  listScheduleProposals: async () => [],
  listProgressUpdates: async () => updates,
  listPayments: async () => payments,
  listPaymentRequests: async () => paymentRequests,
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/models/provider_model', { findProfile: async () => null });
mockModule('../src/config/supabase', { supabase: {} });
mockModule('../src/config', { paymongo: { secretKey: '', baseUrl: 'https://example.invalid' } });
mockModule('../src/utils/paymongo', {});
mockModule('../src/utils/storage', {
  getProviderFileUrl: async () => null,
  getUserPhotoUrl: async () => null,
});
mockModule('../src/utils/ai_sentiment', { analyzeSentiment: async () => 'neutral' });

const { getTracking, listJobs } = require('../src/controllers/workflow_controllers');
const { listIncoming } = require('../src/controllers/servicerequest_controllers');

const invoke = async (handler, req) => {
  const res = {
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await handler({ query: {}, ...req }, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return res;
};

const invokeListJobs = async () =>
  (await invoke(listJobs, { user: { user_id: 'provider-1' } })).body.jobs[0];
const invokeJobList = async () =>
  (await invoke(listJobs, { user: { user_id: 'provider-1' } })).body.jobs;
const invokeTracking = async () =>
  (await invoke(getTracking, { user: { user_id: 'customer-1' } })).body;
const invokeIncoming = async () =>
  (await invoke(listIncoming, { user: { user_id: 'provider-1' }, query: { filter: 'pending' } })).body.requests;

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
  recipient.status = 'accepted';
  payments = [payment('initial', 'paid', 210)];
  paymentRequests = [];
});

test('customer Track keeps an accepted quotation Pending until the initial payment is paid', async () => {
  row.request_status = 'Approved';
  payments = [];

  let groups = await invokeTracking();
  assert.equal(groups.sent.length, 1);
  assert.equal(groups.sent[0].cardType, 'timeline');
  assert.equal(groups.sent[0].statusLabel, 'Awaiting initial payment');
  assert.equal(groups.sent[0].initialPaymentPaid, false);
  assert.equal(groups.ongoing.length, 0);

  payments = [payment('initial', 'pending', 210)];
  groups = await invokeTracking();
  assert.equal(groups.sent.length, 1);
  assert.equal(groups.ongoing.length, 0);

  payments = [payment('initial', 'paid', 210)];
  groups = await invokeTracking();
  assert.equal(groups.sent.length, 0);
  assert.equal(groups.ongoing.length, 1);
  assert.equal(groups.ongoing[0].initialPaymentPaid, true);
  assert.equal(groups.ongoing[0].statusLabel, 'In progress');
});

test('provider Incoming keeps an accepted quotation Pending until the initial payment is paid', async () => {
  row.request_status = 'Approved';
  payments = [];

  let requests = await invokeIncoming();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].status, 'quoted');
  assert.equal(requests[0].statusLabel, 'Awaiting Payment');
  assert.equal(requests[0].quotation.total, 1000);

  payments = [payment('initial', 'pending', 210)];
  requests = await invokeIncoming();
  assert.equal(requests.length, 1);

  payments = [payment('additional', 'paid', 100)];
  requests = await invokeIncoming();
  assert.equal(requests.length, 1);

  payments = [payment('initial', 'paid', 210)];
  requests = await invokeIncoming();
  assert.equal(requests.length, 0);
});

test('provider Jobs excludes accepted requests until the initial payment is paid', async () => {
  row.request_status = 'Approved';
  payments = [];
  assert.equal((await invokeJobList()).length, 0);

  payments = [payment('initial', 'pending', 210)];
  assert.equal((await invokeJobList()).length, 0);

  payments = [payment('additional', 'paid', 100)];
  assert.equal((await invokeJobList()).length, 0);

  payments = [payment('initial', 'paid', 210)];
  const jobs = await invokeJobList();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, 'Active');
});

test('an initial payment does not add unselected quoted providers to Jobs', async () => {
  row.request_status = 'Approved';
  recipient.status = 'quoted';
  payments = [payment('initial', 'paid', 210)];

  assert.equal((await invokeJobList()).length, 0);
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
