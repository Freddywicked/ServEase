const test = require('node:test');
const assert = require('node:assert/strict');

// Load the real controllers/services with local dependencies replaced by fakes.
// This suite never needs environment variables, a database, or real OTP delivery.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const config = {
  nodeEnv: 'production',
  otp: { ttlMinutes: 5, maxAttempts: 5, resendCooldownSeconds: 30 },
  philsms: { apiToken: 'test-token', senderId: 'ServEase', allowFallback: false },
};
const otpRows = new Map();
let emailDelivery;
let smsDelivery;
let createdUser;

const matchingRows = (rows, filters) => rows.filter((row) =>
  filters.every(({ column, values }) => values.includes(row[column]))
);

const supabase = {
  from(table) {
    let operation = 'select';
    let single = false;
    let changes;
    const filters = [];
    const builder = {
      select: () => builder,
      eq(column, value) { filters.push({ column, values: [value] }); return builder; },
      in(column, values) { filters.push({ column, values }); return builder; },
      limit() { return builder; },
      maybeSingle() { single = true; return builder; },
      upsert(value) {
        operation = 'upsert';
        changes = value;
        return builder;
      },
      update(value) { operation = 'update'; changes = value; return builder; },
      delete() { operation = 'delete'; return builder; },
      then(resolve, reject) {
        let data = null;
        if (table === 'signup_otps') {
          const rows = matchingRows([...otpRows.values()], filters);
          if (operation === 'upsert') otpRows.set(changes.email, { ...changes });
          if (operation === 'update') rows.forEach((row) => Object.assign(row, changes));
          if (operation === 'delete') rows.forEach((row) => otpRows.delete(row.email));
          if (operation === 'select') data = single ? rows[0] || null : rows;
        } else if (table === 'users') {
          data = [];
        }
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return builder;
  },
};

mockModule('../src/config', config);
mockModule('../src/config/supabase', { supabase });
mockModule('../src/services/email', {
  sendSignupOtpEmail: async (to, code) => emailDelivery(to, code),
});
mockModule('../src/utils/jwt', { signToken: () => 'test-token' });
mockModule('../src/models/user_model', {
  findByEmail: async () => null,
  findByUsername: async () => null,
  createCustomer: async (fields) => {
    createdUser = { user_id: 'new-user', role: 'customer', ...fields };
    return createdUser;
  },
  withPhotoUrl: async ({ password_hash, ...user }) => user,
});

const auth = require('../src/controllers/auth_controllers');
const { parseOtpChannel } = require('../src/utils/validators');

const signupBody = (overrides = {}) => ({
  name: 'Test User',
  email: 'test@example.com',
  phone_number: '09171234567',
  password: 'Password1',
  address: 'Test address',
  birthdate: '2000-01-01',
  gender: 'female',
  otp_channel: 'sms',
  ...overrides,
});

const invoke = async (handler, body) => {
  const req = { body };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await handler(req, res, (error) => { if (error) throw error; });
  return res;
};

const originalFetch = global.fetch;
test.after(() => { global.fetch = originalFetch; });
test.beforeEach(() => {
  otpRows.clear();
  emailDelivery = async (to, code) => { emailDelivery.last = { to, code }; };
  emailDelivery.last = null;
  smsDelivery = null;
  createdUser = null;
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    smsDelivery = { url, payload, code: /code is (\d{6})/.exec(payload.message)[1] };
    return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }) };
  };
});

test('SMS selection sends to the normalized phone and the OTP completes signup', async () => {
  const body = signupBody();
  const sent = await invoke(auth.requestOtp, body);

  assert.equal(sent.body.channel, 'sms');
  assert.equal(smsDelivery.payload.recipient, '639171234567');
  assert.equal(emailDelivery.last, null);
  assert.match(smsDelivery.code, /^\d{6}$/);
  assert.notEqual(otpRows.get(body.email).code_hash, smsDelivery.code);

  const registered = await invoke(auth.register, { ...body, otp: smsDelivery.code });
  assert.equal(registered.statusCode, 201);
  assert.equal(registered.body.token, 'test-token');
  assert.equal(registered.body.user.email, body.email);
  assert.equal(registered.body.user.phone_number, '+639171234567');
  assert.equal(registered.body.user.role, 'customer');
  assert.equal('password' in createdUser, false);
  assert.equal('password_hash' in registered.body.user, false);
  assert.equal(otpRows.size, 0, 'a successful OTP is single-use');
});

test('email selection sends only email and the same OTP completes signup', async () => {
  const body = signupBody({ email: 'EMAIL@example.com', otp_channel: 'email' });
  const sent = await invoke(auth.requestOtp, body);

  assert.equal(sent.body.channel, 'email');
  assert.equal(smsDelivery, null);
  assert.equal(emailDelivery.last.to, 'email@example.com');
  assert.match(emailDelivery.last.code, /^\d{6}$/);

  const registered = await invoke(auth.register, { ...body, otp: emailDelivery.last.code });
  assert.equal(registered.statusCode, 201);
  assert.equal(registered.body.user.email, 'email@example.com');
});

test('missing channels remain SMS-compatible and invalid channels send nothing', async () => {
  assert.equal(parseOtpChannel({}), 'sms');
  assert.equal(parseOtpChannel({ otp_channel: ' EMAIL ' }), 'email');
  assert.throws(
    () => parseOtpChannel({ otp_channel: 'push' }),
    (error) => error.status === 400 && Boolean(error.details.otp_channel)
  );

  await assert.rejects(invoke(auth.requestOtp, signupBody({ otp_channel: 'push' })), {
    status: 400,
  });
  assert.equal(smsDelivery, null);
  assert.equal(emailDelivery.last, null);
  assert.equal(otpRows.size, 0);
});

test('a failed email delivery removes the pending OTP so retry is immediate', async () => {
  emailDelivery = async () => {
    const error = new Error('Delivery failed');
    error.status = 502;
    throw error;
  };
  const body = signupBody({ otp_channel: 'email' });
  await assert.rejects(invoke(auth.requestOtp, body), { status: 502 });
  assert.equal(otpRows.size, 0);
});

test('wrong codes are rejected and do not create an account', async () => {
  const body = signupBody({ otp_channel: 'email' });
  await invoke(auth.requestOtp, body);

  await assert.rejects(invoke(auth.register, { ...body, otp: '000000' }), {
    status: 400,
    message: 'Invalid or expired OTP',
  });
  assert.equal(createdUser, null);
  assert.equal(otpRows.get(body.email).attempts, 1);
});
