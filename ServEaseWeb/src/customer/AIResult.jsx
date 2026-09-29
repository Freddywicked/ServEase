import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
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

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// The shape below is what the AI diagnosis result is expected to look like once the
// backend is wired up. It's hard-coded here per the current task so the screen has
// something real to render, but it should be deleted once the fetch below is live.
//
// TODO (backend-ready): replace this constant and the fake delay in the effect below with
// a real request, e.g.:
//
//   useEffect(() => {
//     let cancelled = false;
//     async function runDiagnosis() {
//       try {
//         // const result = await api.getAiDiagnosis(requestId); // requestId from route state
//         // if (!cancelled) { setDiagnosis(result); setStatus('done'); }
//       } catch (err) {
//         // if (!cancelled) setStatus('error');
//       }
//     }
//     runDiagnosis();
//     return () => { cancelled = true; };
//   }, [requestId]);
//
// Expected response shape (adjust to match the actual API contract):
//   {
//     probableCause: string,
//     confidencePercent: number,       // 0–100
//     relatedChecks: string[],         // short chip labels, e.g. ['Power Jack', ...]
//     troubleshootingSuggestions: [{ title: string, description: string }],
//   }
const MOCK_DIAGNOSIS = {
  probableCause: 'Liquid damage to charging circuit',
  confidencePercent: 87,
  relatedChecks: ['Power Jack', 'Motherboard Check', 'Safety Test'],
  troubleshootingSuggestions: [
    { title: 'Check your Power Adapter', description: 'Try another charger or wall outlet.' },
    { title: 'Disconnect Peripherals', description: 'Remove USB devices and other peripherals.' },
  ],
};
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

// How long the loading state is shown before the mock result appears. Remove once the
// real fetch above drives the loading/done transition instead of a timer.
const MOCK_LOADING_MS = 1600;

export default function AIResult() {
  const navigate = useNavigate();

  // TODO: this screen is reached after AIDiagnosis_Skip.jsx triggers the backend's AI
  // diagnosis for the current service request. If the request id is needed to fetch the
  // result, read it here (e.g. from route state / params: const { requestId } = useParams();).

  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [diagnosis, setDiagnosis] = useState(null);

  useEffect(() => {
    // TODO (backend-ready): see the comment block above MOCK_DIAGNOSIS for the real
    // fetch this timer is standing in for.
    const timer = setTimeout(() => {
      setDiagnosis(MOCK_DIAGNOSIS);
      setStatus('done');
    }, MOCK_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleSolved = () => {
    // TODO: call the backend to close out this request as resolved, e.g.
    // await api.updateServiceRequest(requestId, { status: 'resolved_by_ai' });
    navigate('/customer/dashboard');
  };

  const handleFindProviders = () => {
    // TODO: carry the diagnosis along so a matched provider can see it, e.g.
    // navigate('/customer/providers', { state: { requestId, diagnosis } });
    navigate('/customer/providers');
  };

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
          </>
        )}
      </div>
    </CustomerSidebar>
  );
}