import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import ExitRequestControl from '../components/ExitRequestControl.jsx';
import { getDraftRequestId, skipAiDiagnosis } from '../api/client';

function ChoiceButton({ label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="box-border flex h-[46px] w-full max-w-[640px] cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-70 rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] px-6 font-[Quicksand] text-[15px] font-bold text-white"
    >
      {label}
    </button>
  );
}

// Step progress bar for the 4-step "Creating Service Request" flow.
// Keep this identical on every step screen and render it directly BELOW the <h1>.
// `activeStep` is 1-indexed.
function StepProgress({ activeStep, totalSteps = 4 }) {
  return (
    <div
      role="progressbar"
      aria-label="Service request progress"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={activeStep}
      aria-valuetext={`Step ${activeStep} of ${totalSteps}`}
      className="mb-8 flex w-full gap-3"
    >
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-[9px] flex-1 rounded-[10px] transition-colors duration-300 ${i < activeStep ? 'bg-[#0255AF]' : 'bg-[#D9D9D9]'}`}
        />
      ))}
    </div>
  );
}

export default function AIDiagnosis_Skip() {
  const navigate = useNavigate();
  const requestId = getDraftRequestId(); // saved by CreateServiceRequest.jsx
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  // No draft request (e.g. the page was opened directly): start from the beginning.
  if (!requestId) return <Navigate to="/customer/requests/new" replace />;

  // The AI diagnosis itself is run by AIResult.jsx (POST /api/service-requests/:id/ai-diagnosis).
  const handleUseAI = () => navigate('/customer/requests/new/ai-result');

  const handleSkip = async () => {
    setIsBusy(true);
    setError('');
    try {
      await skipAiDiagnosis(requestId);
      navigate('/customer/requests/new/recommend-providers');
    } catch (err) {
      setError(err.message || "Couldn't continue. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <CustomerSidebar>
      <div className="relative box-border w-full px-5 py-8 sm:px-10 lg:py-10 lg:pl-[47px] lg:pr-[57px]">
        <ExitRequestControl requestId={requestId} />
        <h1 className="m-0 mb-4 font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Creating Service Request
        </h1>
        <StepProgress activeStep={2} />

        <p className="m-0 mb-1 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
          To enhance your service request details, we offer AI Diagnosis.
        </p>
        <p className="m-0 mb-6 font-[Roboto] text-[14px] text-[#414141] sm:text-[15px]">
          Let AI analyze your problem before booking.
        </p>

        <div className="flex flex-col items-center gap-4">
          <ChoiceButton label="Use AI Diagnosis" onClick={handleUseAI} disabled={isBusy} />
          <ChoiceButton label="Skip AI and Find Service Providers" onClick={handleSkip} disabled={isBusy} />
        </div>
        {error && (
          <p role="alert" className="m-0 mt-4 text-center font-[Roboto] text-[13px] text-[#B91C1C]">
            {error}
          </p>
        )}
      </div>
    </CustomerSidebar>
  );
}