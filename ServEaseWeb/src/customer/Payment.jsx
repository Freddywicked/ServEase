import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar';
import gcashLogo from '../assets/gcash_logo.png';
import qrphLogo from '../assets/qrph_logo.png';
import cardLogo from '../assets/cc_logo.png';
// import { api } from '../api/client'; // BACKEND: use whichever request helper ../api/client exports

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
   Everything is hard-coded for now (DEFAULT_PAYMENT below is only a fallback).

   BACKEND INTEGRATION (READY)
   Proposed endpoint (rename to match ServEaseBackend):
     POST /api/customer/requests/:requestId/payments
     body:     { method: 'gcash' | 'qrph' | 'card', paymentType: 'initial' | 'additional' | 'final' }
     response: { paymentId, amount, checkoutUrl }   // or a QR payload for 'qrph'

   Replace the TODO lines inside handleContinue:
     const { data } = await api.post(`/customer/requests/${requestId}/payments`, {
       method: selectedMethod,
       paymentType,
     });
     window.location.assign(data.checkoutUrl);       // redirect to the payment gateway page
   The amount should come from the backend (GET /api/customer/requests/:requestId/payments/due)
   instead of router state, so it cannot be changed from the browser.
   ===================================================================================== */

const DEFAULT_PAYMENT = {
  requestId: 'SR-0000',
  amount: 170, // fallback only — normally passed in by the screen that starts the payment
  paymentType: 'initial',
};

const PAYMENT_METHODS = [
  { id: 'gcash', label: 'Gcash', logo: gcashLogo, logoClass: 'h-[40px] w-[53px]' },
  { id: 'qrph', label: 'QR PH', logo: qrphLogo, logoClass: 'h-[46px] w-[46px]' },
  { id: 'card', label: 'Debit/Credit', logo: cardLogo, logoClass: 'h-[24px] w-[40px]' },
];

const formatPeso = (n) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Payment({ requestId, amount, paymentType, onBack, onContinue }) {
  const navigate = useNavigate();
  const params = useParams();
  const { state } = useLocation();

  const resolvedRequestId =
    requestId ?? state?.requestId ?? params.requestId ?? DEFAULT_PAYMENT.requestId;
  const resolvedAmount = amount ?? state?.amount ?? DEFAULT_PAYMENT.amount;
  const resolvedType = paymentType ?? state?.paymentType ?? DEFAULT_PAYMENT.paymentType;

  const [selectedMethod, setSelectedMethod] = useState(null);

  const handleBack = () => (onBack ? onBack() : navigate(-1));

  const handleContinue = async () => {
    if (!selectedMethod) return;

    if (onContinue) {
      onContinue({ requestId: resolvedRequestId, method: selectedMethod, paymentType: resolvedType });
      return;
    }

    // TODO (BACKEND): create the payment, then redirect to the gateway.
    // const { data } = await api.post(`/customer/requests/${resolvedRequestId}/payments`, {
    //   method: selectedMethod,
    //   paymentType: resolvedType,
    // });
    // window.location.assign(data.checkoutUrl);
    console.log('Continue to payment', {
      requestId: resolvedRequestId,
      method: selectedMethod,
      paymentType: resolvedType,
      amount: resolvedAmount,
    });
    navigate('/customer/requests');
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
            {formatPeso(resolvedAmount)}
          </p>

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
                <span className="flex h-[46px] w-[53px] flex-none items-center justify-center">
                  <img src={method.logo} alt="" className={`${method.logoClass} object-contain`} />
                </span>
                <span className="ml-[5px] font-[Inter] text-[13px] leading-[22px] text-[#5B5959]">
                  {method.label}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selectedMethod}
            className="mt-[46px] h-8 w-24 cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[Inter] text-[10px] font-bold leading-[17px] text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#FFFDFD]"
          >
            Continue
          </button>
        </div>
      </div>
    </CustomerSidebar>
  );
}