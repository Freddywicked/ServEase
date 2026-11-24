// src/utils/pricing.js
// ONE place for the money rules of a quotation, shared by workflow_controllers.js (tracking, payment
// due) and servicerequest_controllers.js (the customer's request details), so the mobile and web apps
// always see the same numbers.
//
//   provider total  = labor + parts
//   service fee     = 5% of the provider amount covered by an initial/final payment
//   initial payment = 20% of the provider total + 5% of that initial provider amount
//   final payment   = the remaining provider amount + the remaining service fee
// Additional payments carry no service fee. The 20% booking payment and the 5% platform fee
// are separate charges with separate purposes.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Initial payment the customer makes to confirm the booking and secure the appointment slot.
const INITIAL_FEE_RATE = 0.2;
// ServEase's platform fee, applied only to initial and final payments (never additional payments).
const SERVICE_FEE_RATE = 0.05;

const serviceFeeFor = (labor, parts) => round2(((Number(labor) || 0) + (Number(parts) || 0)) * SERVICE_FEE_RATE);

// A quotations row -> { labor, parts, serviceFee, total }. Parts is 0 when the provider set no price.
// Uses the fee saved on the quotation; only rows without one are calculated with the current rule.
const quoteBreakdown = (q) => {
  const labor = Number(q?.labor_cost) || 0;
  const parts = Number(q?.parts_cost) || 0;
  const stored = q?.service_fee;
  const hasStored = stored !== undefined && stored !== null && Number.isFinite(Number(stored));
  const serviceFee = hasStored ? round2(stored) : serviceFeeFor(labor, parts);
  return { labor, parts, serviceFee, total: round2(labor + parts + serviceFee) };
};

const initialBaseAmountFor = (labor, parts) => round2(((Number(labor) || 0) + (Number(parts) || 0)) * INITIAL_FEE_RATE);

// Provider booking amount plus this stage's own 5% service fee: 300 + 15 = 315 for a 1,500 quote.
const initialAmountFor = (labor, parts) => {
  const initialBase = initialBaseAmountFor(labor, parts);
  return round2(initialBase + serviceFeeFor(initialBase));
};

// What the customer apps read from providers[].quote (RequestDetails.js).
const toQuoteDto = (q) => {
  const b = quoteBreakdown(q);
  return {
    labor: b.labor,
    parts: b.parts,
    serviceFee: b.serviceFee,
    total: b.total,
    initialFeePercent: Math.round(INITIAL_FEE_RATE * 10000) / 100,
    initialAmount: initialAmountFor(b.labor, b.parts),
  };
};

// How much of each PAID payment is ServEase's 5% platform fee. Initial and final payments include
// their own fee; additional payments carry none. The provider keeps the rest of each payment.
// For a 1,500 provider quotation: initial = 300 + 15, final = 1,200 + 60.
// Returns a Map(payment_id -> fee portion) for receipts and provider earnings.
const feeSplit = (quote, payments) => {
  const out = new Map();
  if (!quote) return out;
  const { labor, parts, serviceFee } = quoteBreakdown(quote);
  const initialBase = initialBaseAmountFor(labor, parts);
  const initialFee = serviceFeeFor(initialBase);
  const initialCharge = round2(initialBase + initialFee);
  let remaining = serviceFee;
  [...payments]
    .filter((p) => p.status === 'paid')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((p) => {
      const amount = Number(p.amount) || 0;
      let share = 0;
      if (p.stage === 'initial' && initialCharge > 0) share = round2((amount * initialFee) / initialCharge);
      else if (p.stage === 'final') share = amount; // capped below to whatever fee remains
      share = Math.max(0, Math.min(share, remaining, amount));
      remaining = round2(remaining - share);
      out.set(p.payment_id, share);
    });
  return out;
};

// Stored in service_request_providers.declined_reason when the CUSTOMER declines a quotation, so the
// Closed tab can tell "you declined" from "the provider declined" without a new column. A customer's
// optional detail follows the marker; legacy rows contain only the marker itself.
const CUSTOMER_DECLINED_QUOTATION_REASON = 'The customer declined the quotation';

const encodeCustomerQuotationDecline = (reason) => {
  const detail = String(reason ?? '').trim();
  return detail ? `${CUSTOMER_DECLINED_QUOTATION_REASON}: ${detail}` : CUSTOMER_DECLINED_QUOTATION_REASON;
};

const isCustomerQuotationDecline = (storedReason) => {
  const value = String(storedReason || '');
  return value === CUSTOMER_DECLINED_QUOTATION_REASON || value.startsWith(`${CUSTOMER_DECLINED_QUOTATION_REASON}:`);
};

const decodeCustomerQuotationDecline = (storedReason) => {
  if (!isCustomerQuotationDecline(storedReason)) return null;
  const detail = String(storedReason).slice(CUSTOMER_DECLINED_QUOTATION_REASON.length).replace(/^:\s*/, '').trim();
  return detail || null;
};

module.exports = {
  round2,
  INITIAL_FEE_RATE,
  serviceFeeFor,
  quoteBreakdown,
  initialAmountFor,
  toQuoteDto,
  feeSplit,
  CUSTOMER_DECLINED_QUOTATION_REASON,
  encodeCustomerQuotationDecline,
  isCustomerQuotationDecline,
  decodeCustomerQuotationDecline,
};