const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const config = {
  nodeEnv: 'production',
  otp: { ttlMinutes: 5 },
  resend: { apiKey: 'test-key', fromEmail: 'ServEase <otp@example.com>' },
};
let sendEmail;
mockModule('../src/config', config);
mockModule('resend', {
  Resend: class {
    constructor() {
      this.emails = { send: async (message) => sendEmail(message) };
    }
  },
});

const { sendSignupOtpEmail } = require('../src/services/email');

test.beforeEach(() => {
  config.nodeEnv = 'production';
  config.resend.apiKey = 'test-key';
  config.resend.fromEmail = 'ServEase <otp@example.com>';
  sendEmail = async () => ({ error: null });
});

test('signup email contains the supplied recipient and six-digit code', async () => {
  let message;
  sendEmail = async (value) => { message = value; return { error: null }; };

  await sendSignupOtpEmail('user@example.com', '123456');

  assert.equal(message.from, 'ServEase <otp@example.com>');
  assert.equal(message.to, 'user@example.com');
  assert.equal(message.subject, 'Your ServEase verification code');
  assert.match(message.text, /123456/);
  assert.match(message.html, /123456/);
  assert.match(message.text, /5 minutes/);
});

test('production reports missing email configuration without sending', async () => {
  config.resend.apiKey = '';
  let called = false;
  sendEmail = async () => { called = true; return { error: null }; };

  await assert.rejects(sendSignupOtpEmail('user@example.com', '123456'), {
    status: 500,
    message: 'Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).',
  });
  assert.equal(called, false);
});

test('production surfaces a Resend delivery failure as a 502', async () => {
  sendEmail = async () => ({ error: { message: 'Rejected' } });
  await assert.rejects(sendSignupOtpEmail('user@example.com', '123456'), {
    status: 502,
    message: 'Failed to send the verification code.',
  });
});
