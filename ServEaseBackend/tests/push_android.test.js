const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let sentMessage;
const firebaseAdmin = {
  cert: (serviceAccount) => serviceAccount,
  initializeApp: () => {},
};

mockModule('../src/config', { firebase: { serviceAccountPath: '' } });
mockModule('firebase-admin', firebaseAdmin);
mockModule('firebase-admin/messaging', {
  getMessaging: () => ({
    sendEachForMulticast: async (message) => {
      sentMessage = message;
      return { responses: message.tokens.map(() => ({ success: true })) };
    },
  }),
});
mockModule('../src/models/workflow_model', {
  listDeviceTokens: async () => ['device-token-1'],
  deleteDeviceToken: async () => {},
});

const originalServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'servease-test' });
const { sendPushToUser } = require('../src/utils/push');

test.after(() => {
  if (originalServiceAccount == null) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalServiceAccount;
});

test('Android pushes use high priority and the ServEase notification channel', async () => {
  await sendPushToUser('user-1', {
    title: 'ServEase',
    body: 'New service request',
    data: { notificationId: 'notification-1', attempt: 2 },
  });

  assert.equal(sentMessage.tokens[0], 'device-token-1');
  assert.deepEqual(sentMessage.android, {
    priority: 'HIGH',
    notification: {
      channelId: 'servease_notifications',
      sound: 'default',
    },
  });
  assert.deepEqual(sentMessage.data, { notificationId: 'notification-1', attempt: '2' });
});
