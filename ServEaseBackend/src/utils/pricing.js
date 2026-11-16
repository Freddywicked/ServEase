// src/utils/pricing.js
// ONE place for the money rules of a quotation, shared by workflow_controllers.js (tracking, payment
// due) and servicerequest_controllers.js (the customer's request details), so the mobile and web apps
// always see the same numbers.
//
//   total          = labor + parts + service fee
//   initial payment = INITIAL_FEE_RATE (20%) of the total. The service fee is part of the total, but it is
//                     a different thing from the 20% initial payment.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Initial payment the customer makes after approving a quotation (20% so customers who cannot afford
// 50% can still pay). Change it here only.
const INITIAL_FEE_RATE = 0.2;

// SERVICE FEE (platform fee). NOT FINALIZED: fixed amount or percentage of (labor + parts)?
// Until that is decided it is configurable without touching code:
//   SERVICE_FEE_MODE  = 'fixed' | 'percent'   (default 'fixed')
//   SERVICE_FEE_VALUE = amount in PHP when fixed, percent when 'percent'   (default 20, the Figma sample)
// The fee is calculated ONCE, when the provider sends the quotation, and saved in quotations.service_fee
// (see migrations/quotation_service_fee.sql). Changing the rule later therefore only affects quotations
// created afterwards. Older rows with no saved fee fall back to the current rule.
const SERVICE_FEE_MODE = process.env.SERVICE_FEE_MODE === 'percent' ? 'percent' : 'fixed';
const configuredFee = Number(process.env.SERVICE_FEE_VALUE);
const SERVICE_FEE_VALUE =
  process.env.SERVICE_FEE_VALUE !== undefined && Number.isFinite(configuredFee) && configuredFee >= 0 ? configuredFee : 20;

const serviceFeeFor = (labor, parts) =>
  SERVICE_FEE_MODE === 'percent' ? round2(((Number(labor) || 0) + (Number(parts) || 0)) * (SERVICE_FEE_VALUE / 100)) : round2(SERVICE_FEE_VALUE);

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

const initialAmountFor = (total) => round2((Number(total) || 0) * INITIAL_FEE_RATE);

// What the customer apps read from providers[].quote (RequestDetails.js).
const toQuoteDto = (q) => {
  const b = quoteBreakdown(q);
  return {
    labor: b.labor,
    parts: b.parts,
    serviceFee: b.serviceFee,
    total: b.total,
    initialFeePercent: Math.round(INITIAL_FEE_RATE * 10000) / 100,
    initialAmount: initialAmountFor(b.total),
  };
};

// How much of each PAID payment is platform fee (Option A: the fee is spread over the initial and the
// final payment in the same proportion as the rest of the bill; additional payments carry no fee).
//   total 2,100 (labor 1,500 + parts 500 + fee 100): initial 420 -> fee 20, final 1,680 -> fee 80.
// Returns a Map(payment_id -> fee portion). Used for receipts (subtotal / service fee / total) and to keep
// the fee out of the provider's earnings.
const feeSplit = (quote, payments) => {
  const out = new Map();
  if (!quote) return out;
  const { serviceFee, total } = quoteBreakdown(quote);
  let remaining = serviceFee;
  [...payments]
    .filter((p) => p.status === 'paid')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((p) => {
      const amount = Number(p.amount) || 0;
      let share = 0;
      if (p.stage === 'initial' && total > 0) share = round2((amount * serviceFee) / total);
      else if (p.stage === 'final') share = amount; // the final payment takes whatever fee is left
      share = Math.max(0, Math.min(share, remaining, amount));
      remaining = round2(remaining - share);
      out.set(p.payment_id, share);
    });
  return out;
};

// Stored in service_request_providers.declined_reason when the CUSTOMER declines a quotation, so the
// Closed tab can tell "you declined" from "the provider declined" without a new column.
const CUSTOMER_DECLINED_QUOTATION_REASON = 'The customer declined the quotation';

module.exports = {
  round2,
  INITIAL_FEE_RATE,
  serviceFeeFor,
  quoteBreakdown,
  initialAmountFor,
  toQuoteDto,
  feeSplit,
  CUSTOMER_DECLINED_QUOTATION_REASON,
};