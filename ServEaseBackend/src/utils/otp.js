/**
 * OTP generation and delivery (PhilSMS).
 * @format
 */

import crypto from 'node:crypto';
import config from '../config/index.js';
import { httpError } from '../middleware/errorHandler.js';

const PHILSMS_SEND_URL = 'https://app.philsms.com/api/v3/sms/send';

export const generateOtpCode = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

/**
 * Normalises a Philippine mobile number to the international format PhilSMS
 * expects (639XXXXXXXXX). Accepts "09XXXXXXXXX", "+639XXXXXXXXX" or
 * "639XXXXXXXXX"; anything else is passed through for PhilSMS to validate.
 */
export const normalizePhPhone = phone => {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('09') && digits.length === 11) {
    return `63${digits.slice(1)}`;
  }
  return digits;
};

/**
 * Delivers the OTP via SMS through PhilSMS.
 *
 * When PHILSMS_API_TOKEN is not configured (local development) the code is
 * logged to the server console instead of sending a real SMS.
 */
export const sendOtpSms = async (phone, code) => {
  const message = `Your ServEase verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes. Do not share it with anyone.`;

  if (!config.philsms.apiToken) {
    console.log(`[sms-mock] OTP for ${phone}: ${code}`);
    return;
  }

  const response = await fetch(PHILSMS_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.philsms.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      recipient: normalizePhPhone(phone),
      sender_id: config.philsms.senderId,
      type: 'plain',
      message,
    }),
  });
  const detail = await response.text().catch(() => '');
  if (response.ok) {
    return;
  }
  console.error(`[philsms] Failed to send OTP to ${phone}: ${detail}`);
  // Outside production (e.g. PhilSMS trial "sending limit exceeded") fall
  // back to logging the code so the flow stays testable. In production the
  // failure surfaces as a 502.
  if (config.philsms.allowFallback) {
    console.log(`[sms-fallback] OTP for ${phone}: ${code}`);
    return;
  }
  throw httpError(502, 'Failed to send the verification code.');
};
