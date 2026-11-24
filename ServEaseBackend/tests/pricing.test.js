const test = require('node:test');
const assert = require('node:assert/strict');

const {
  serviceFeeFor,
  quoteBreakdown,
  initialAmountFor,
  toQuoteDto,
  feeSplit,
  CUSTOMER_DECLINED_QUOTATION_REASON,
  encodeCustomerQuotationDecline,
  isCustomerQuotationDecline,
  decodeCustomerQuotationDecline,
} = require('../src/utils/pricing');

const quote = {
  labor_cost: 750,
  parts_cost: 750,
  service_fee: 75,
};

test('a 1,500 provider quotation has a 75 service fee and a 315 initial charge', () => {
  assert.equal(serviceFeeFor(750, 750), 75);
  assert.deepEqual(quoteBreakdown(quote), {
    labor: 750,
    parts: 750,
    serviceFee: 75,
    total: 1575,
  });
  assert.equal(initialAmountFor(750, 750), 315);
  assert.deepEqual(toQuoteDto(quote), {
    labor: 750,
    parts: 750,
    serviceFee: 75,
    total: 1575,
    initialFeePercent: 20,
    initialAmount: 315,
  });
});

test('labor-only quotations use the same 20% booking plus 5% service-fee rule', () => {
  assert.equal(serviceFeeFor(1500, 0), 75);
  assert.equal(initialAmountFor(1500, 0), 315);
});

test('initial and final payments carry their own 5% fee; additional payments carry none', () => {
  const payments = [
    { payment_id: 'initial', amount: 315, stage: 'initial', status: 'paid', created_at: '2026-11-17T09:00:00Z' },
    { payment_id: 'additional', amount: 100, stage: 'additional', status: 'paid', created_at: '2026-11-17T10:00:00Z' },
    { payment_id: 'final', amount: 1260, stage: 'final', status: 'paid', created_at: '2026-11-17T11:00:00Z' },
  ];

  const split = feeSplit(quote, payments);
  assert.equal(split.get('initial'), 15);
  assert.equal(split.get('additional'), 0);
  assert.equal(split.get('final'), 60);

  const providerReceipts = payments.reduce((sum, payment) => sum + payment.amount - split.get(payment.payment_id), 0);
  assert.equal(providerReceipts, 1600); // 1,500 quotation + 100 additional payment
});

test('pending payments do not consume any service fee', () => {
  const split = feeSplit(quote, [
    { payment_id: 'pending', amount: 315, stage: 'initial', status: 'pending', created_at: '2026-11-17T09:00:00Z' },
    { payment_id: 'final', amount: 1260, stage: 'final', status: 'paid', created_at: '2026-11-17T11:00:00Z' },
  ]);

  assert.equal(split.has('pending'), false);
  assert.equal(split.get('final'), 75);
});

test('customer quotation declines retain their reason without losing customer attribution', () => {
  const stored = encodeCustomerQuotationDecline('  The price is beyond my budget.  ');

  assert.equal(stored, `${CUSTOMER_DECLINED_QUOTATION_REASON}: The price is beyond my budget.`);
  assert.equal(isCustomerQuotationDecline(stored), true);
  assert.equal(decodeCustomerQuotationDecline(stored), 'The price is beyond my budget.');
});

test('legacy customer declines and provider decline reasons remain compatible', () => {
  assert.equal(encodeCustomerQuotationDecline(''), CUSTOMER_DECLINED_QUOTATION_REASON);
  assert.equal(isCustomerQuotationDecline(CUSTOMER_DECLINED_QUOTATION_REASON), true);
  assert.equal(decodeCustomerQuotationDecline(CUSTOMER_DECLINED_QUOTATION_REASON), null);
  assert.equal(isCustomerQuotationDecline('Provider schedule is unavailable'), false);
  assert.equal(decodeCustomerQuotationDecline('Provider schedule is unavailable'), null);
});
