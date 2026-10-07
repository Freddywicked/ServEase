import { useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { clearDraftRequestId } from '../api/client';
import bigEllipse from '../assets/icon_bigellipse.png';
import bigCheck from '../assets/icon_bigcheck.png';

// Step progress: four 85px x 9px segments with a 4px gap (Figma). This screen is step 4 of 4 (all filled).
function StepProgress({ activeStep, totalSteps = 4 }) {
  return (
    <div className="mt-[10px] flex gap-1">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-[9px] w-[85px] rounded-[10px] ${i < activeStep ? 'bg-[#0255AF]' : 'bg-[#D9D9D9]'}`}
        />
      ))}
    </div>
  );
}

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// Static copy shown on the confirmation screen. Once the backend is wired up, the
// provider name / request reference could be shown here too (see TODO below).
const CONFIRMATION_TITLE = 'Sent to the Service Provider!';
const CONFIRMATION_MESSAGE =
  "This service provider will review your request and send a pre-repair quotation. You'll be notified the moment it arrives.";
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

export default function SubmitServiceRequest() {
  const navigate = useNavigate();

  // The request was sent to the chosen provider(s) by RecommendServiceProvider.jsx
  // (submitServiceRequest(requestId, providerIds) -> POST /api/service-requests/:id/submit).
  // It now appears in each provider's Incoming Service Requests list.
  // The "you'll be notified" message relies on the backend creating a notification when the
  // provider's quotation arrives (see Notifications.jsx).

  const handleDone = () => {
    clearDraftRequestId(); // the flow is finished, forget the draft request id
    navigate('/customer/dashboard');
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Creating Service Request
        </h1>
        <StepProgress activeStep={4} />

        <div className="mt-12 flex flex-col items-center text-center lg:mt-[173px]">
          <div className="relative flex h-[100px] w-[100px] items-center justify-center">
            <img src={bigEllipse} alt="" className="absolute inset-0 h-full w-full" />
            <img src={bigCheck} alt="" className="relative h-[48px] w-[52px]" />
          </div>

          <h2 className="m-0 mt-[39px] font-[Roboto] text-[20px] font-bold leading-[23px] text-[#292727]">
            {CONFIRMATION_TITLE}
          </h2>
          <p className="m-0 mt-[31px] w-[300px] max-w-full font-[Roboto] text-[16px] font-normal leading-[19px] text-[#292727]">
            {CONFIRMATION_MESSAGE}
          </p>
        </div>

        <div className="mt-12 flex justify-center pb-[38px] lg:mt-[239px]">
          <button
            type="button"
            onClick={handleDone}
            className="box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white"
          >
            Done
          </button>
        </div>
      </div>
    </CustomerSidebar>
  );
}