const test = require('node:test');
const assert = require('node:assert/strict');

const CUSTOMER = 'customer-1';
const PROVIDER = 'provider-1';
const REQUEST = 'request-1';
const DELETE_TIME = '2026-11-20T12:00:00.000Z';

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const requestRow = {
  request_id: REQUEST,
  request_number: 7,
  customer_id: CUSTOMER,
  request_status: 'In Progress',
  category: 'Home Repair',
};
let messages;
let deletions;

const Request = {
  parseRequestId: (value) => (/^SR-\d+$/i.test(value) ? Number(value.slice(3)) : null),
  formatRequestId: (number) => `SR-${String(number).padStart(4, '0')}`,
  findByRequestNo: async () => requestRow,
  findRecipient: async (requestId, userId) =>
    requestId === REQUEST && userId === PROVIDER ? { request_id: REQUEST, provider_id: PROVIDER } : null,
  listForCustomer: async (userId) => (userId === CUSTOMER ? [requestRow] : []),
  listRecipientsForProvider: async (userId) =>
    userId === PROVIDER ? [{ request_id: REQUEST, provider_id: PROVIDER, status: 'accepted' }] : [],
  findByIds: async () => [requestRow],
  listRecipients: async () => [{ request_id: REQUEST, provider_id: PROVIDER }],
  findUsersByIds: async () => ({
    [CUSTOMER]: { name: 'Customer One', photo_url: null },
    [PROVIDER]: { name: 'Provider One', photo_url: null },
  }),
};

const Workflow = {
  listMessagesForRequests: async (requestIds) => messages.filter((m) => requestIds.includes(m.request_id)),
  listMessages: async () => messages,
  listPayments: async () => [],
  markMessagesSeen: async () => {},
  listConversationDeletions: async (userId, requestIds) =>
    deletions.filter((d) => d.user_id === userId && requestIds.includes(d.request_id)),
  findConversationDeletion: async (requestId, userId) =>
    deletions.find((d) => d.request_id === requestId && d.user_id === userId) || null,
  deleteConversationForUser: async (requestId, userId) => {
    const deletion = { request_id: requestId, user_id: userId, deleted_at: DELETE_TIME };
    deletions = deletions.filter((d) => !(d.request_id === requestId && d.user_id === userId));
    deletions.push(deletion);
    return deletion;
  },
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/models/provider_model', { findProfile: async () => null });
mockModule('../src/config/supabase', { supabase: {} });
mockModule('../src/config', { paymongo: { secretKey: '', baseUrl: 'https://example.invalid' } });
mockModule('../src/utils/paymongo', {});
mockModule('../src/utils/storage', { getProviderFileUrl: async () => null, getUserPhotoUrl: async () => null });
mockModule('../src/utils/ai_sentiment', { analyzeSentiment: async () => 'neutral' });

const {
  listConversations,
  listMessages,
  deleteConversation,
} = require('../src/controllers/workflow_controllers');

const invoke = async (handler, userId) => {
  const res = {
    body: null,
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await handler({ user: { user_id: userId }, params: { id: 'SR-0007' }, body: {} }, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return res.body;
};

const message = (id, senderId, body, createdAt) => ({
  message_id: id,
  request_id: REQUEST,
  sender_id: senderId,
  body,
  created_at: createdAt,
  seen_by_customer: senderId === CUSTOMER,
  seen_by_provider: senderId === PROVIDER,
});

test.beforeEach(() => {
  messages = [
    message('message-1', CUSTOMER, 'Hello', '2026-11-19T10:00:00.000Z'),
    message('message-2', PROVIDER, 'How can I help?', '2026-11-20T10:00:00.000Z'),
  ];
  deletions = [];
});

test('customer deletion hides existing history only for the customer', async () => {
  assert.deepEqual(await invoke(deleteConversation, CUSTOMER), { ok: true });

  assert.deepEqual((await invoke(listMessages, CUSTOMER)).messages, []);
  assert.deepEqual(
    (await invoke(listMessages, PROVIDER)).messages.map((m) => m.text),
    ['Hello', 'How can I help?']
  );
  assert.equal(messages.length, 2, 'shared message rows must not be deleted');
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0].user_id, CUSTOMER);
});

test('provider deletion is independent and also preserves shared messages', async () => {
  await invoke(deleteConversation, PROVIDER);

  assert.deepEqual((await invoke(listMessages, PROVIDER)).messages, []);
  assert.deepEqual(
    (await invoke(listMessages, CUSTOMER)).messages.map((m) => m.text),
    ['Hello', 'How can I help?']
  );
  assert.equal(messages.length, 2);
  assert.equal(deletions[0].user_id, PROVIDER);
});

test('deleted conversation is hidden until a newer message arrives', async () => {
  await invoke(deleteConversation, CUSTOMER);
  assert.deepEqual((await invoke(listConversations, CUSTOMER)).conversations, []);
  assert.equal((await invoke(listConversations, PROVIDER)).conversations[0].lastMessage, 'How can I help?');

  messages.push(message('message-3', PROVIDER, 'Are you still available?', '2026-11-21T09:00:00.000Z'));

  const customerList = (await invoke(listConversations, CUSTOMER)).conversations;
  assert.equal(customerList.length, 1);
  assert.equal(customerList[0].lastMessage, 'Are you still available?');
  assert.equal(customerList[0].hasUnread, true);
  assert.deepEqual(
    (await invoke(listMessages, CUSTOMER)).messages.map((m) => m.text),
    ['Are you still available?']
  );
  assert.equal((await invoke(listMessages, PROVIDER)).messages.length, 3);
});

test('an empty deleted conversation stays hidden only for its deleting user', async () => {
  messages = [];
  await invoke(deleteConversation, CUSTOMER);

  assert.deepEqual((await invoke(listConversations, CUSTOMER)).conversations, []);
  assert.equal((await invoke(listConversations, PROVIDER)).conversations.length, 1);
});

test('a nonparticipant cannot record a conversation deletion', async () => {
  await assert.rejects(invoke(deleteConversation, 'another-user'), (error) => error.statusCode === 404);
  assert.deepEqual(deletions, []);
  assert.equal(messages.length, 2);
});
