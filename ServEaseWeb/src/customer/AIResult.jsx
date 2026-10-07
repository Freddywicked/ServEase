import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import {
  clearDraftRequestId,
  getDraftRequestId,
  resolveServiceRequest,
  runAiDiagnosis,
} from '../api/client';
import loadingIcon from '../assets/icon_loading.png';

// Same step progress visual as the previous two screens — this screen is step 3 of 4.
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

export default function AIResult() {
  const navigate = useNavigate();
  const requestId = getDraftRequestId(); // saved by CreateServiceRequest.jsx

  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [diagnosis, setDiagnosis] = useState(null);
  const [actionError, setActionError] = useState('');

  // Runs the AI diagnosis on the backend (POST /api/service-requests/:id/ai-diagnosis).
  // Response: { diagnosis: { probableCause, confidencePercent, relatedChecks, troubleshootingSuggestions } }
  // The backend saves the result, so calling it again (e.g. a refresh) returns the same one.
  useEffect(() => {
    if (!requestId) return undefined;
    let cancelled = false;
    runAiDiagnosis(requestId)
      .then((data) => {
        if (cancelled) return;
        setDiagnosis(data.diagnosis);
        setStatus('done');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (!requestId) return <Navigate to="/customer/requests/new" replace />;

  const handleSolved = async () => {
    setActionError('');
    try {
      await resolveServiceRequest(requestId);
      clearDraftRequestId();
      navigate('/customer/dashboard');
    } catch (err) {
      setActionError(err.message || "Couldn't close this request. Please try again.");
    }
  };

  // The provider will see this diagnosis together with the request, so nothing needs to be carried along.
  const handleFindProviders = () => navigate('/customer/requests/new/recommend-providers');

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <StepProgress activeStep={3} />

        <h1 className="m-0 mb-6 font-[Quicksand] text-[32px] font-bold text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Creating Service Request
        </h1>

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <img src={loadingIcon} alt="" className="h-10 w-10 animate-spin" />
            <p className="m-0 font-[Roboto] text-[14px] text-[#484040]">
              Reading your description and running AI diagnosis…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="m-0 font-[Roboto] text-[14px] text-[#B91C1C]">
              We couldn&apos;t run AI diagnosis right now.
            </p>
            <button
              type="button"
              onClick={handleFindProviders}
              className="rounded-lg bg-gradient-to-r from-[#0255AF] to-[#04A5A5] px-5 py-2 font-[Quicksand] text-[14px] font-bold text-white"
            >
              Find Service Providers Instead
            </button>
          </div>
        )}

        {status === 'done' && diagnosis && (
          <>
            <h2 className="m-0 mb-1 font-[Roboto] text-[16px] font-bold text-[#292727] sm:text-[18px]">
              Here&apos;s what we found
            </h2>
            <p className="m-0 mb-5 font-[Roboto] text-[13px] text-[#484040] sm:text-[14px]">
              This is a suggestion — you&apos;ll always choose your own service provider if you&apos;d rather not use it.
            </p>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <div className="box-border rounded-[10px] border border-[#818080] bg-white p-5">
                <p className="m-0 mb-1 font-[SF_Pro,system-ui,sans-serif] text-[11px] font-semibold uppercase tracking-wide text-[#817C7C]">
                  Probable Cause
                </p>
                <p className="m-0 mb-3 font-[Quicksand] text-[17px] font-bold text-black">
                  {diagnosis.probableCause}
                </p>

                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-[#E7E7E7]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0255AF] to-[#04A5A5]"
                    style={{ width: `${diagnosis.confidencePercent}%` }}
                  />
                </div>
                <p className="m-0 mb-4 text-right font-[Roboto] text-[12px] text-[#484040]">
                  {diagnosis.confidencePercent}%
                </p>
                <p className="m-0 mb-3 font-[Roboto] text-[12px] text-[#817C7C]">
                  Confidence based on similar reported cases
                </p>

                <div className="flex flex-wrap gap-2">
                  {diagnosis.relatedChecks.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[#DAD2D2] px-3 py-1 font-[Roboto] text-[12px] text-[#292727]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="box-border rounded-[10px] border border-[#818080] bg-white p-5">
                <p className="m-0 mb-3 font-[Quicksand] text-[15px] font-bold text-black">
                  Troubleshooting Suggestions
                </p>
                <div className="flex flex-col gap-3">
                  {diagnosis.troubleshootingSuggestions.map((tip) => (
                    <div key={tip.title} className="rounded-[10px] border border-[#EFEFEF] bg-[#FAFAFA] p-3">
                      <p className="m-0 font-[Roboto] text-[13px] font-bold text-[#292727]">{tip.title}</p>
                      <p className="m-0 font-[Roboto] text-[12px] text-[#817C7C]">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="m-0 mb-3 font-[Roboto] text-[15px] font-semibold text-[#292727] sm:text-[16px]">
              Is the problem solved?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSolved}
                className="box-border flex h-[44px] flex-1 min-w-[160px] cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[14px] font-bold text-white"
              >
                Yes, solved
              </button>
              <button
                type="button"
                onClick={handleFindProviders}
                className="box-border flex h-[44px] flex-1 min-w-[160px] cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-[#005FCA] to-[#04A5A5] font-[Quicksand] text-[14px] font-bold text-white"
              >
                Find Service Providers
              </button>
            </div>
            {actionError && (
              <p role="alert" className="m-0 mt-3 font-[Roboto] text-[13px] text-[#B91C1C]">
                {actionError}
              </p>
            )}
          </>
        )}
      </div>
    </CustomerSidebar>
  );
}