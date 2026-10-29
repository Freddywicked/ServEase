/**
 * Transactional email through Resend (password reset codes).
 * Mirrors services/otp.js: when Resend isn't configured, or outside production if
 * Resend rejects a send, the code is printed in the server terminal so the flow
 * stays testable.
 */
const { Resend } = require('resend');
const config = require('../config');

let client = null;
const getClient = () => {
  if (!client) client = new Resend(config.resend.apiKey);
  return client;
};

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const sendPasswordResetEmail = async (to, code) => {
  const minutes = config.otp.ttlMinutes;

  // Development only: always print the code so you are never stuck.
  if (config.nodeEnv !== 'production') {
    console.log(`[dev] Password reset code for ${to}: ${code}`);
  }

  if (!config.resend.apiKey || !config.resend.fromEmail) {
    if (config.nodeEnv === 'production') {
      throw httpError(500, 'Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).');
    }
    console.log(`[email-mock] Resend not configured; code for ${to} printed above.`);
    return;
  }

  const { error } = await getClient().emails.send({
    from: config.resend.fromEmail,
    to,
    subject: 'Your ServEase password reset code',
    text:
      `Your ServEase verification code is ${code}. It expires in ${minutes} minutes. ` +
      `If you didn't request a password reset, you can ignore this email.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">` +
      `<h2 style="color:#021E79">Reset your password</h2>` +
      `<p>Use this code to reset your ServEase password:</p>` +
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0255AF">${code}</p>` +
      `<p>It expires in ${minutes} minutes. Do not share it with anyone.</p>` +
      `<p style="color:#666;font-size:12px">If you didn't request this, you can safely ignore this email.</p>` +
      `</div>`,
  });

  if (error) {
    console.error(`[resend] Failed to send reset code to ${to}:`, error);
    if (config.nodeEnv !== 'production') {
      console.log(`[email-fallback] Code for ${to} printed above.`);
      return;
    }
    throw httpError(502, 'Failed to send the verification code.');
  }
};

module.exports = { sendPasswordResetEmail };