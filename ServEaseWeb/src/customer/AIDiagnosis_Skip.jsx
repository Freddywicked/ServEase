import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar.jsx';

// Same step progress visual as CreateServiceRequest.jsx — this screen is step 2 of 4.
function StepProgress({ activeStep, totalSteps = 4 }) {
  return (
    <div className="mb-6 flex gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-[9px] flex-1 rounded-full ${i < activeStep ? 'bg-[#0255AF]' : 'bg-[#D9D9D9]'}`}
        />
      ))}
    </div>
  );
}

function ChoiceButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="box-border flex h-[46px] w-full max-w-[520px] cursor-pointer items-center justify-between rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] px-6 font-[Quicksand] text-[15px] font-bold text-white"
    >
      <span className="mx-auto">{label}</span>
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white">
        <ChevronRight size={14} color="#0255AF" />
      </span>
    </button>
  );
}

export default function AIDiagnosis_Skip() {
  const navigate = useNavigate();

  // TODO: this screen is reached after the draft service request from CreateServiceRequest.jsx
  // has been created on the backend. If that request's id is needed on the next screen(s),
  // read it here (e.g. from route state / params: const { requestId } = useParams();) and
  // forward it when navigating below.

  const handleUseAI = () => {
    // TODO: kick off the backend's AI diagnosis for this request, e.g.
    // await api.startAiDiagnosis(requestId);
    // then navigate once it's been triggered (AIResuslt.jsx does the actual polling/loading).
    navigate('/customer/requests/new/ai-result');
  };

  const handleSkip = () => {
    // TODO: mark the backend request as "skip AI" if that status matters, e.g.
    // await api.updateServiceRequest(requestId, { aiDiagnosis: 'skipped' });
    navigate('/customer/providers');
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <StepProgress activeStep={2} />

        <h1 className="m-0 mb-4 font-[Quicksand] text-[32px] font-bold text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Creating Service Request
        </h1>

        <p className="m-0 mb-1 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
          To enhance your service request details, we offer AI Diagnosis.
        </p>
        <p className="m-0 mb-6 font-[Roboto] text-[14px] text-[#414141] sm:text-[15px]">
          Let AI analyze your problem before booking.
        </p>

        <div className="flex flex-col items-start gap-4">
          <ChoiceButton label="Use AI Diagnosis" onClick={handleUseAI} />
          <ChoiceButton label="Skip AI and Find Service Providers" onClick={handleSkip} />
        </div>
      </div>
    </CustomerSidebar>
  );
}