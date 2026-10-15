import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import gcashLogo from '../assets/gcash_logo.png';
import qrphLogo from '../assets/qrph_logo.png';
import cardLogo from '../assets/cc_logo.png';
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
          Polled after the payment to confirm it before returning to My Requests.
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
  // "Payment Completed" modal — shown after a cash FINAL payment.
  const [showCompleted, setShowCompleted] = useState(false);

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

  // Confirm the payment is recorded (dev mode pays instantly; PayMongo checkouts are
  // confirmed server-side via the webhook / status check).
  const waitForConfirmation = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const { payment } = await getPaymentStatus(resolvedRequestId);
        if (payment?.status === 'paid') return true;
      } catch {
        // keep polling — a status hiccup must not strand the customer
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
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
    //    moves to the Done tab) and the "Payment Completed" modal offers "Rate and Review".
    if (selectedMethod === 'cash') {
      if (resolvedType !== 'final') {
        handleBack();
        return;
      }
      setProcessing(true);
      setError('');
      try {
        await payForRequest(resolvedRequestId, {
          amount: dueAmount,
          method: 'cash',
          stage: 'final',
        });
        setShowCompleted(true);
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
      await waitForConfirmation();
      navigate('/customer/requests');
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

      {showCompleted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-completed-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6"
        >
          <div className="relative w-full max-w-[420px] rounded-[16px] bg-white px-8 pb-8 pt-10 text-center">
            <button
              type="button"
              onClick={() => setShowCompleted(false)}
              aria-label="Close"
              className="absolute right-4 top-4 cursor-pointer border-none bg-transparent p-0"
            >
              <X size={22} color="#000" />
            </button>
            <h2
              id="payment-completed-title"
              className="m-0 font-[Inter] text-[16px] font-bold leading-[22px] text-[#292727]"
            >
              Payment Completed
            </h2>
            <p className="m-0 mt-3 font-[Inter] text-[12px] leading-[16px] text-[#484040]">
              Payment completed.
            </p>
            <button
              type="button"
              onClick={() => navigate(rateAndReviewPath(resolvedRequestId))}
              className="mt-5 h-8 cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] px-6 font-[Inter] text-[11px] font-bold text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
            >
              Rate and Review
            </button>
          </div>
        </div>
      )}
    </CustomerSidebar>
  );
}