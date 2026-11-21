const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const notificationRow = { notification_id: 'notification-1' };
let pushCalls;
let lookupCalls;
const supabase = {
  from(table) {
    assert.equal(table, 'notifications');
    return {
      insert() { return this; },
      select() { return this; },
      single: async () => ({ data: notificationRow, error: null }),
    };
  },
};
const Request = {
  findByIds: async (ids) => {
    lookupCalls.push(ids);
    return [{ request_id: ids[0], request_number: 7 }];
  },
  formatRequestId: (number) => `SR-${String(number).padStart(4, '0')}`,
};
const push = {
  sendPushToUser: async (userId, payload) => {
    pushCalls.push({ userId, payload });
  },
};

mockModule('../src/config/supabase', { supabase });
mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/utils/push', push);
const Workflow = require('../src/models/workflow_model');

test.beforeEach(() => {
  pushCalls = [];
  lookupCalls = [];
});

test('push payload includes the public request ref and preserves the UUID', async () => {
  const row = await Workflow.notify({
    userId: 'provider-1',
    type: 'new_request',
    message: 'New service request',
    requestId: 'request-uuid-1',
  });

  assert.equal(row, notificationRow);
  assert.deepEqual(lookupCalls, [['request-uuid-1']]);
  assert.equal(pushCalls.length, 1);
  assert.equal(pushCalls[0].userId, 'provider-1');
  assert.deepEqual(pushCalls[0].payload.data, {
    type: 'new_request',
    requestId: 'request-uuid-1',
    requestRef: 'SR-0007',
    notificationId: 'notification-1',
  });
});

test('an existing public request ref does not require another database lookup', async () => {
  await Workflow.notify({
    userId: 'customer-1',
    type: 'quotation_received',
    message: 'New quotation',
    requestId: 'SR-0008',
  });

  assert.deepEqual(lookupCalls, []);
  assert.equal(pushCalls[0].payload.data.requestRef, 'SR-0008');
  assert.equal(pushCalls[0].payload.data.requestId, 'SR-0008');
});

test('a request-ref lookup failure does not prevent the push or saved notification', async () => {
  const originalFindByIds = Request.findByIds;
  Request.findByIds = async () => { throw new Error('temporary lookup failure'); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const row = await Workflow.notify({
      userId: 'provider-1',
      type: 'new_request',
      message: 'New service request',
      requestId: 'request-uuid-2',
    });
    assert.equal(row, notificationRow);
    assert.equal(pushCalls.length, 1);
    assert.equal(pushCalls[0].payload.data.requestRef, '');
  } finally {
    Request.findByIds = originalFindByIds;
    console.error = originalError;
  }
});
