const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let activityField;
let activityCutoff;
const deviceQuery = {
  select() { return this; },
  eq() { return this; },
  gte(field, value) {
    activityField = field;
    activityCutoff = value;
    return Promise.resolve({ data: [{ fcm_token: 'active-device' }], error: null });
  },
};
const supabase = {
  from(table) {
    assert.equal(table, 'device_tokens');
    return deviceQuery;
  },
};
const User = {
  findProvider: async () => null,
  withPhotoUrl: async (user) => user,
};
const signToken = (user) => `renewed-token-for-${user.user_id}`;

mockModule('../src/config/supabase', { supabase });
mockModule('../src/models/user_model', User);
mockModule('../src/utils/jwt', { signToken, verifyToken: () => ({}) });

const Workflow = require('../src/models/workflow_model');
const AuthController = require('../src/controllers/auth_controllers');

test('push lookup excludes device tokens inactive for seven days', async () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const earliest = Date.now() - sevenDaysMs;
  const tokens = await Workflow.listDeviceTokens('user-1');
  const latest = Date.now() - sevenDaysMs;

  assert.deepEqual(tokens, ['active-device']);
  assert.equal(activityField, 'updated_at');
  const cutoffTime = new Date(activityCutoff).getTime();
  assert.ok(cutoffTime >= earliest && cutoffTime <= latest);
});

test('a valid session check returns a renewed JWT and current role data', async () => {
  let payload;
  const req = { user: { user_id: 'user-1', name: 'Test User' } };
  const res = { json: (body) => { payload = body; } };

  await AuthController.me(req, res, () => {});

  assert.equal(payload.token, 'renewed-token-for-user-1');
  assert.equal(payload.user.user_id, 'user-1');
  assert.equal(payload.provider, null);
});
