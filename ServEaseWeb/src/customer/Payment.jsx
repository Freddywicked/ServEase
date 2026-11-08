import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import gcashLogo from '../assets/gcash_logo.png';
import qrphLogo from '../assets/qrph_logo.png';
import cardLogo from '../assets/cc_logo.png';
import receiptLogo from '../assets/servease_logo.png'; // ServEase logo shown on the receipt
import { getPaymentDue, getPaymentStatus, payForRequest } from '../api/client';

/* =====================================================================================
   PAYMENT SCREEN — shared by every payment process
   (initial fee after approving a quotation, additional payment, final payment)
   -------------------------------------------------------------------------------------
   HOW TO USE
   Route:   <Route path="/customer/requests/:requestId/payment" element={<Payment />} />
   Open it with:
     navigate(`/customer/requests/${id}/payment`, {
       state: { requestId: id, amount: 170, paymentType: 'initial' }, // 'initial' | 'additional' | 'final'
     });
   It can also be rendered with props: <Payment requestId amount paymentType onBack onContinue />.

   BACKEND INTEGRATION (LIVE)
     GET  /api/service-requests/:requestId/payment-due
          -> { total, paid, due: { initial, additional, final } }
          The displayed amount comes from the server, not from router state, so it
          cannot be changed from the browser.
     POST /api/service-requests/:requestId/payment   body: { amount, method, stage }
          -> { payment, checkoutUrl? }
          With PayMongo keys configured the browser is redirected to checkoutUrl;
          without them (dev mode) the payment is recorded as paid immediately.
     GET  /api/service-requests/:requestId/payment-status
          Polled after the payment to confirm it; once paid, the receipt popup opens.
          The payment (or its `receipt` object) feeds the receipt — see buildReceipt below
          for the fields it reads (receiptNo, requestNumber, paidAt, customerName,
          providerName, subtotal, serviceFee, total, method, reference).
   Optional router state used as a fallback for the receipt: requestNumber, customerName,
   providerName, serviceFee.
   ===================================================================================== */

const PAYMENT_METHODS = [
  { id: 'gcash', label: 'Gcash', logo: gcashLogo, logoClass: 'h-[40px] w-[53px]' },
  { id: 'qrph', label: 'QR PH', logo: qrphLogo, logoClass: 'h-[46px] w-[46px]' },
  { id: 'card', label: 'Debit/Credit', logo: cardLogo, logoClass: 'h-[24px] w-[40px]' },
  // Cash has no logo (matches the Figma): the label sits right next to the radio button.
  { id: 'cash', label: 'Cash', logo: null, logoClass: '' },
];

// Where "Rate and Review" goes after a cash final payment (the Rating route in App.jsx).
const rateAndReviewPath = (id) => `/customer/requests/${id}/review`;

const formatPeso = (n) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* -------------------------------------------------------------------------------------
   RECEIPT ("Payment Processed" popup) — nothing on it is hard-coded: every value comes
   from the backend payment record via buildReceipt, falling back to what this screen knows.
   BACKEND — ideally the payment response / payment-status returns a `receipt` object:
     { receiptNo, requestNumber, paidAt, customerName, providerName,
       subtotal, serviceFee, total, method, reference }   (snake_case keys also accepted)
   "Download Receipt" opens the print dialog with only the receipt ("Save as PDF").
   ------------------------------------------------------------------------------------- */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const METHOD_LABELS = { gcash: 'GCash', qrph: 'QRPh', card: 'Debit/Credit Card', cash: 'Cash' };

// Per payment stage: what the receipt calls it, the line item, and the modal subtitle.
const STAGE_COPY = {
  initial: {
    type: 'Initial Fee',
    lineItem: 'Initial repair payment',
    subtitle: 'Your 20% initial payment has been processed.',
  },
  additional: {
    type: 'Additional payment fee',
    lineItem: 'Additional payment',
    subtitle: 'The payment for additional parts has been processed.',
  },
  final: {
    type: 'Final Fee',
    lineItem: 'Final repair payment',
    subtitle: 'Your final payment has been processed.',
  },
};

// "26 October 2026, 10:30 AM"
const formatReceiptDate = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

// ₱2,000 for whole amounts, ₱2,000.50 when there are centavos (matches the Figma).
const formatReceiptPeso = (value) => {
  const n = Number(value) || 0;
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Builds the receipt from whatever the backend returned for the payment.
 * NOTE: `fallback.total` (the amount charged) is assumed to already include the service fee.
 */
function buildReceipt(payment, methodId, fallback = {}) {
  const src = payment?.receipt ?? payment ?? {};
  const stageCopy = STAGE_COPY[fallback.stage] || STAGE_COPY.initial;
  const total = Number(src.total ?? src.amount ?? fallback.total) || 0;
  const serviceFee = Number(src.serviceFee ?? src.service_fee ?? fallback.serviceFee ?? 0) || 0;
  const method = src.method ?? methodId;

  return {
    receiptNo: src.receiptNo ?? src.receipt_number ?? '',
    requestNumber: src.requestNumber ?? src.request_number ?? fallback.requestNumber ?? '',
    datePaid: formatReceiptDate(src.paidAt ?? src.paid_at),
    paymentType: stageCopy.type,
    customerName: src.customerName ?? src.customer_name ?? fallback.customerName ?? '',
    providerName: src.providerName ?? src.provider_name ?? fallback.providerName ?? '',
    lineItem: stageCopy.lineItem,
    subtotal: Number(src.subtotal ?? total - serviceFee) || 0,
    serviceFee,
    total,
    methodLabel: METHOD_LABELS[method] || METHOD_LABELS[methodId] || '—',
    reference: src.reference ?? src.paymentReference ?? src.payment_reference ?? '',
  };
}

const Divider = () => <div className="h-[1.17px] w-full bg-[#5B5959]" />;

const MetaRow = ({ label, value, className = '' }) => (
  <p className={`m-0 text-[11px] text-black ${className}`}>
    <span className="font-bold">{label}: </span>
    {value || '—'}
  </p>
);

// Width of the "Amount" column on the receipt (amounts are left-aligned inside it).
const AMOUNT_COL = 'w-[89px] flex-none';

function ReceiptCard({ receipt }) {
  const requestNumber = receipt.requestNumber
    ? `#${String(receipt.requestNumber).replace(/^#/, '')}`
    : '';

  return (
    <div className="box-border min-h-[410px] w-full rounded-[10px] border-[5px] border-[#18315B] bg-white pb-[16px] pl-[34px] pr-[22px] pt-[10px] font-[Inter]">
      {/* Header: logo on the left, title centred across the card */}
      <div className="relative -ml-[17px] flex h-[54px] items-center">
        <img src={receiptLogo} alt="ServEase" className="h-[54px] w-[54px] flex-none object-contain" />
        <h4 className="absolute inset-x-0 m-0 pl-[17px] pr-[22px] text-center text-[15px] font-bold leading-[23px] text-[#021E79]">
          PAYMENT RECEIPT
        </h4>
      </div>

      {/* Details */}
      <div className="mt-[14px] pb-[5px] pl-[4px]">
        <MetaRow label="Receipt no." value={receipt.receiptNo} className="leading-[19px]" />
        <MetaRow label="Service Request" value={requestNumber} className="leading-[19px]" />
        <MetaRow label="Date Paid" value={receipt.datePaid} className="leading-[19px]" />
        <MetaRow label="Payment Type" value={receipt.paymentType} className="leading-[19px]" />
      </div>

      <Divider />

      {/* Parties */}
      <div className="grid grid-cols-2 py-[10px] text-center leading-[14px] text-black">
        <div className="min-w-0">
          <p className="m-0 truncate text-[10px] font-bold">{receipt.customerName || '—'}</p>
          <p className="m-0 text-[9px] italic">Received from</p>
        </div>
        <div className="min-w-0 pr-[24%]">
          <p className="m-0 truncate text-[10px] font-bold">{receipt.providerName || '—'}</p>
          <p className="m-0 text-[9px] italic">Sent to</p>
        </div>
      </div>

      <Divider />

      {/* Items */}
      <div className="mt-[6px] pl-[4px] text-[11px] text-black">
        <div className="flex h-[22px] items-center font-bold">
          <span className="flex-1">Description</span>
          <span className={AMOUNT_COL}>Amount</span>
        </div>
        <div className="flex h-[22px] items-center">
          <span className="flex-1">{receipt.lineItem}</span>
          <span className={AMOUNT_COL}>{formatReceiptPeso(receipt.subtotal)}</span>
        </div>
        {receipt.serviceFee > 0 && (
          <div className="flex h-[19px] items-center">
            <span className="flex-1">Service Fee</span>
            <span className={AMOUNT_COL}>{formatReceiptPeso(receipt.serviceFee)}</span>
          </div>
        )}
      </div>

      <div className="mt-[2px]">
        <Divider />
      </div>

      <div className="mt-[6px] flex h-[22px] items-center pl-[4px] text-[11px] text-black">
        <span className="flex-1">TOTAL</span>
        <span className={AMOUNT_COL}>{formatReceiptPeso(receipt.total)}</span>
      </div>

      {/* Footer */}
      <div className="mt-[20px]">
        <MetaRow label="Payment Method" value={receipt.methodLabel} className="leading-[24px]" />
        {receipt.reference && (
          <MetaRow label="Payment Reference" value={receipt.reference} className="leading-[24px]" />
        )}
      </div>
    </div>
  );
}

/**
 * Props:
 *   receipt        object from buildReceipt()
 *   isCashFinal    true after a cash FINAL payment -> "Payment Completed" wording
 *   subtitle       line under the title (STAGE_COPY[stage].subtitle)
 *   primaryLabel   "Done" or "Rate and Review"
 *   onClose        X button
 *   onPrimary      Done / Rate and Review button
 */
function PaymentReceiptModal({
  receipt,
  isCashFinal = false,
  subtitle,
  primaryLabel = 'Done',
  onClose,
  onPrimary,
}) {
  if (!receipt) return null;

  return (
    <>
      {/* Print only the receipt when "Download Receipt" opens the print dialog. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payment-receipt-print, #payment-receipt-print * { visibility: visible !important; }
          #payment-receipt-print {
            position: fixed; left: 0; top: 0; width: 100%;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-receipt-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
      >
        <div className="relative box-border flex max-h-[92vh] w-full max-w-[701px] flex-col rounded-[10px] bg-white pb-[34px] pl-[44px] pr-[33px] pt-[37px]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-[37px] top-[19px] cursor-pointer border-none bg-transparent p-0"
          >
            <X size={24} strokeWidth={2.5} color="#000" />
          </button>

          <h2
            id="payment-receipt-title"
            className="m-0 font-[Inter] text-[16px] font-bold leading-[27px] text-[#414141]"
          >
            {isCashFinal ? 'Payment Completed' : 'Payment Processed'}
          </h2>
          <p className="m-0 font-[Inter] text-[13px] leading-[22px] text-[#5B5959]">
            {isCashFinal ? 'Payment completed.' : subtitle}
          </p>

          <div className="mt-[20px] min-h-0 flex-1 overflow-y-auto">
            <div id="payment-receipt-print" className="bg-white">
              <ReceiptCard receipt={receipt} />
            </div>
          </div>

          <div className="mt-[29px] flex items-center justify-end gap-[15px]">
            <button
              type="button"
              onClick={() => window.print()}
              className="h-[29px] w-[151px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[linear-gradient(270deg,#04A5A5_0%,#0255AF_100%)] font-[Inter] text-[10px] font-bold leading-[17px] text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
            >
              Download Receipt
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="h-[27px] w-[115px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[Inter] text-[10px] font-bold leading-[17px] text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Payment({ requestId, amount, paymentType, onBack, onContinue }) {
  const navigate = useNavigate();
  const params = useParams();
  const { state } = useLocation();

  const resolvedRequestId = requestId ?? state?.requestId ?? params.requestId ?? null;
  const resolvedType = paymentType ?? state?.paymentType ?? 'initial';

  const [selectedMethod, setSelectedMethod] = useState(null);
  // The amount is read from the backend (payment-due); the router-state amount is
  // only a preview until the server answers.
  const [dueAmount, setDueAmount] = useState(amount ?? state?.amount ?? null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  // Receipt popup ("Payment Processed" / "Payment Completed") shown after every payment.
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!resolvedRequestId) return undefined;
    let cancelled = false;
    getPaymentDue(resolvedRequestId)
      .then((data) => {
        if (cancelled) return;
        const serverAmount = data?.due?.[resolvedType];
        if (Number.isFinite(serverAmount) && serverAmount > 0) setDueAmount(serverAmount);
      })
      .catch((err) => {
        // Keep the router-state amount; only complain when there is no amount at all.
        if (!cancelled && dueAmount == null) {
          setError(err.message || 'Could not load the amount due.');
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRequestId, resolvedType]);

  const handleBack = () => (onBack ? onBack() : navigate(-1));

  const stageCopy = STAGE_COPY[resolvedType] || STAGE_COPY.initial;
  const isCashFinal = resolvedType === 'final' && selectedMethod === 'cash';

  // Builds the receipt from the backend payment record; the Payment screen's own data
  // only fills in what the backend did not send.
  const openReceipt = (payment, methodId) => {
    setReceipt(
      buildReceipt(payment, methodId, {
        stage: resolvedType,
        total: dueAmount,
        requestNumber: state?.requestNumber ?? resolvedRequestId,
        customerName: state?.customerName,
        providerName: state?.providerName,
        serviceFee: state?.serviceFee,
      }),
    );
  };

  // Closing the receipt (X) or pressing Done returns to My Requests so a paid stage can't
  // be paid twice; "Rate and Review" continues to the review of the finished request.
  const handleReceiptClose = () => {
    setReceipt(null);
    navigate('/customer/requests');
  };
  const handleReceiptPrimary = () => {
    setReceipt(null);
    if (resolvedType === 'final') navigate(rateAndReviewPath(resolvedRequestId));
    else navigate('/customer/requests');
  };

  // Confirm the payment is recorded (dev mode pays instantly; PayMongo checkouts are
  // confirmed server-side via the webhook / status check). Returns the paid payment
  // record (used for the receipt), or null if it could not be confirmed.
  const waitForConfirmation = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const { payment } = await getPaymentStatus(resolvedRequestId);
        if (payment?.status === 'paid') return payment;
      } catch {
        // keep polling — a status hiccup must not strand the customer
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return null;
  };

  const handleContinue = async () => {
    if (!selectedMethod || processing) return;

    if (onContinue) {
      onContinue({ requestId: resolvedRequestId, method: selectedMethod, paymentType: resolvedType });
      return;
    }

    // Cash is paid in person, so there is no checkout:
    //  - initial / additional: nothing is sent, just go back to the previous screen;
    //  - final: the backend records the cash payment (marks the request completed/paid so it
    //    moves to the Done tab) and the receipt popup ("Payment Completed") offers
    //    "Rate and Review".
    if (selectedMethod === 'cash') {
      if (resolvedType !== 'final') {
        handleBack();
        return;
      }
      setProcessing(true);
      setError('');
      try {
        const cashResult = await payForRequest(resolvedRequestId, {
          amount: dueAmount,
          method: 'cash',
          stage: 'final',
        });
        openReceipt(cashResult?.payment ?? cashResult, 'cash');
      } catch (err) {
        setError(err.message || 'Could not complete the request. Please try again.');
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const result = await payForRequest(resolvedRequestId, {
        amount: dueAmount,
        method: selectedMethod,
        stage: resolvedType,
      });
      if (result.checkoutUrl) {
        // PayMongo checkout page; it returns to {backend}/api/payments/return afterwards.
        window.location.assign(result.checkoutUrl);
        return;
      }
      const paidPayment = await waitForConfirmation();
      if (paidPayment) {
        openReceipt(paidPayment, selectedMethod);
        setProcessing(false);
      } else {
        navigate('/customer/requests');
      }
    } catch (err) {
      setError(err.message || 'The payment could not be started. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-[42px] pb-10 pt-[25px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[48px] font-bold leading-[32px] text-[#005FCA]">
          My Requests
        </h1>

        <div className="-ml-2 mt-[25px] flex items-center gap-6">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
          >
            <ChevronLeft size={32} strokeWidth={2.5} color="#000" />
          </button>
          <h2 className="m-0 font-[Inter] text-[20px] font-bold leading-[34px] text-[#292727]">
            Request #{resolvedRequestId}
          </h2>
        </div>

        <div className="mt-[34px] flex max-w-[986px] flex-col items-center">
          <p className="m-0 font-[Inter] text-[20px] font-bold leading-[34px] text-[#414141]">
            {dueAmount != null ? formatPeso(dueAmount) : 'Loading…'}
          </p>

          {error && (
            <p role="alert" className="m-0 mt-3 font-[Inter] text-[13px] text-[#B91C1C]">
              {error}
            </p>
          )}

          <h3 className="m-0 mt-[48px] font-[Inter] text-[16px] font-bold leading-[27px] text-[#18315B]">
            Select Payment Method
          </h3>

          <div role="radiogroup" aria-label="Payment method" className="mt-[10px] flex w-[190px] flex-col">
            {PAYMENT_METHODS.map((method) => (
              <label key={method.id} className="flex h-[46px] cursor-pointer items-center">
                <input
                  type="radio"
                  name="payment-method"
                  value={method.id}
                  checked={selectedMethod === method.id}
                  onChange={() => setSelectedMethod(method.id)}
                  className="peer sr-only"
                />
                <span className="mr-[9px] h-3 w-3 flex-none rounded-full border border-[#BFB7B7] bg-[#D9D9D9] peer-checked:border-[#0255AF] peer-checked:bg-[#0255AF] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0255AF]/40" />
                {method.logo && (
                  <span className="flex h-[46px] w-[53px] flex-none items-center justify-center">
                    <img src={method.logo} alt="" className={`${method.logoClass} object-contain`} />
                  </span>
                )}
                <span className="ml-[5px] font-[Inter] text-[13px] leading-[22px] text-[#5B5959]">
                  {method.label}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMethod || processing || dueAmount == null}
            className="mt-[46px] h-8 w-24 cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[Inter] text-[10px] font-bold leading-[17px] text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#FFFDFD]"
          >
            {processing ? 'Processing…' : 'Continue'}
          </button>
        </div>
      </div>

      <PaymentReceiptModal
        receipt={receipt}
        isCashFinal={isCashFinal}
        subtitle={stageCopy.subtitle}
        primaryLabel={resolvedType === 'final' ? 'Rate and Review' : 'Done'}
        onClose={handleReceiptClose}
        onPrimary={handleReceiptPrimary}
      />
    </CustomerSidebar>
  );
}