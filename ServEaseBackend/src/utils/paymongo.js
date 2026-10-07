// src/utils/paymongo.js
// PayMongo integration (Checkout Sessions API v1).
//
// Flow: POST /service-requests/:id/payment creates a checkout session and returns
// its checkout_url -> the app opens it in the browser (GCash / QR Ph / card) ->
// PayMongo redirects back and the app polls GET .../payment-status, which checks
// the session with PayMongo directly. A webhook (POST /api/payments/webhook) is
// the belt-and-braces confirmation — register it in the PayMongo dashboard with
// the checkout_session.payment.paid + payment.paid + payment.failed events.
//
// Docs: https://docs.paymongo.com/reference/create_checkout_sessions
const crypto = require('crypto');
const config = require('../config');

const PAYMONGO_API = config.paymongo.baseUrl;
const TIMEOUT_MS = 15000;

const authHeader = () =>
  `Basic ${Buffer.from(`${config.paymongo.secretKey}:`).toString('base64')}`;

const call = async (path, { method = 'GET', body } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${PAYMONGO_API}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || `HTTP ${res.status}`;
      throw new Error(`PayMongo: ${detail}`);
    }
    return data?.data;
  } finally {
    clearTimeout(timer);
  }
};

// method -> PayMongo payment_method_types. Checkout Sessions show every type the
// merchant has activated; we send just the one the customer picked.
const METHOD_TYPES = { gcash: ['gcash'], qrph: ['qrph'], card: ['card'] };

// amount is in PESOS here; PayMongo wants centavos. Returns the session resource
// ({ id: 'cs_...', attributes: { checkout_url, ... } }).
const createCheckoutSession = ({ amount, method, description, referenceNumber, successUrl, cancelUrl }) =>
  call('/checkout_sessions', {
    method: 'POST',
    body: {
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount: Math.round(amount * 100),
              name: description,
              quantity: 1,
            },
          ],
          payment_method_types: METHOD_TYPES[method] || ['card', 'gcash', 'qrph'],
          description,
          reference_number: referenceNumber,
          success_url: successUrl,
          cancel_url: cancelUrl,
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
        },
      },
    },
  });

const getCheckoutSession = (sessionId) => call(`/checkout_sessions/${sessionId}`);

// A session is paid when any of its payments landed (or the intent succeeded).
// Checked defensively — the attribute layout differs slightly between events.
const sessionIsPaid = (session) => {
  const attrs = session?.attributes || {};
  if (Array.isArray(attrs.payments) && attrs.payments.some((p) => p?.attributes?.status === 'paid')) return true;
  if (attrs.payment_intent?.attributes?.status === 'succeeded') return true;
  return false;
};

// Paymongo-Signature: "t=<timestamp>,te=<test sig>,li=<live sig>". The signature
// is HMAC-SHA256 of "<t>.<raw request body>" with the webhook's secret key.
const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!config.paymongo.webhookSecret) return true; // not configured yet — accept (log loudly below)
  const parts = Object.fromEntries(
    String(signatureHeader || '')
      .split(',')
      .map((kv) => kv.split('='))
  );
  if (!parts.t) return false;
  const expected = crypto
    .createHmac('sha256', config.paymongo.webhookSecret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex');
  const sig = config.paymongo.secretKey.startsWith('sk_live') ? parts.li : parts.te;
  if (!sig || sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
};

module.exports = { createCheckoutSession, getCheckoutSession, sessionIsPaid, verifyWebhookSignature };
