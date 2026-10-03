import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import starIcon from '../assets/icon_star.png';

// Step progress: four 85px x 9px segments with a 4px gap (Figma). This screen is step 3 of 4.
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

// Blue circle with a white check (22px in the Figma design).
function CheckBadgeIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#0255AF" />
      <path d="M6.8 12.6l3.5 3.5 6.9-7.4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// Expected shape of each recommended provider once the backend is wired up (adjust to the real contract):
//   {
//     id: string | number,
//     name: string,
//     category: string,              // e.g. 'Phone Repair'
//     avatarUrl: string | null,
//     verified: boolean,
//     available: boolean,
//     rating: number,                // e.g. 4.8
//     reviewCount: number,
//     yearsExperience: number,
//     specialities: string,
//     location: string,              // may include distance computed server-side
//     availability: string,          // e.g. 'Mon-Fri, 8AM-6PM'
//   }
const MOCK_PROVIDERS = [
  { id: 1, name: 'Mark Rivera', category: 'Phone Repair', avatarUrl: null, verified: true, available: true, rating: 4.8, reviewCount: 95, yearsExperience: 5, specialities: 'IT and Phone Repair', location: 'Naga City · 2.5 km away', availability: 'Mon-Fri, 8AM-6PM' },
  { id: 2, name: 'Jason Tatum', category: 'Phone Repair', avatarUrl: null, verified: true, available: true, rating: 4.8, reviewCount: 95, yearsExperience: 5, specialities: 'IT and Phone Repair', location: 'Naga City · 2.5 km away', availability: 'Mon-Fri, 8AM-6PM' },
  { id: 3, name: 'Sylvia Lee', category: 'Phone Repair', avatarUrl: null, verified: true, available: true, rating: 4.8, reviewCount: 95, yearsExperience: 5, specialities: 'IT and Phone Repair', location: 'Naga City · 2.5 km away', availability: 'Mon-Fri, 8AM-6PM' },
  { id: 4, name: 'John Doe', category: 'Phone Repair', avatarUrl: null, verified: true, available: true, rating: 4.8, reviewCount: 95, yearsExperience: 5, specialities: 'IT and Phone Repair', location: 'Naga City · 2.5 km away', availability: 'Mon-Fri, 8AM-6PM' },
];
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

export default function RecommendServiceProvider() {
  const navigate = useNavigate();

  // TODO (backend-ready): this screen is reached after "Find Service Providers" in AIResult.jsx.
  // Carry the request context from there via route state, e.g. in AIResult:
  //   // navigate('/customer/recommended-providers', { state: { requestId, category, diagnosis } });
  // and read it here:
  //   // const { state } = useLocation();   // import { useLocation } from 'react-router-dom'
  //   // const { requestId, category, diagnosis } = state ?? {};
  //
  // TODO (backend-ready): replace MOCK_PROVIDERS with providers fetched from the database,
  // matched by the service category the user selected, the user's location, and rating
  // (highest to lowest), e.g.:
  //
  //   // const [providers, setProviders] = useState([]);
  //   // const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  //   //
  //   // useEffect(() => {
  //   //   let cancelled = false;
  //   //   async function loadRecommended() {
  //   //     try {
  //   //       const result = await api.getRecommendedProviders({
  //   //         requestId,
  //   //         category,                 // category selected in the service request
  //   //         location: userLocation,   // user's saved address or coordinates
  //   //         sortBy: 'rating',
  //   //         order: 'desc',
  //   //       });
  //   //       if (!cancelled) { setProviders(result); setStatus('done'); }
  //   //     } catch (err) {
  //   //       if (!cancelled) setStatus('error');
  //   //     }
  //   //   }
  //   //   loadRecommended();
  //   //   return () => { cancelled = true; };
  //   // }, [requestId, category]);

  // Sorted by rating, highest to lowest. Remove once the server returns them already sorted.
  const providers = useMemo(
    () => [...MOCK_PROVIDERS].sort((a, b) => b.rating - a.rating),
    []
  );

  // In the design the two top matches carry the teal highlighted border. They start selected;
  // clicking a card toggles it.
  const [selectedIds, setSelectedIds] = useState(() => new Set(providers.slice(0, 2).map((p) => p.id)));

  const toggleProvider = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    // TODO (backend-ready): attach the selected provider(s) to the request and submit it, e.g.
    // await api.submitServiceRequest({ requestId, providerIds: [...selectedIds], diagnosis });
    // Route: confirmation screen (SubmitServiceRequest.jsx) — adjust if the route name differs.
    navigate('/customer/request-submitted');
  };

  const handleFindAnother = () => {
    // Route: Find Service Providers list (FindServiceProvider.jsx) — adjust if the route name differs.
    // TODO (backend-ready): carry request context along, e.g.
    // navigate('/customer/providers', { state: { requestId, category, diagnosis } });
    navigate('/customer/providers');
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <h1 className="m-0 flex min-h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Creating Service Request
        </h1>
        <StepProgress activeStep={3} />

        <h2 className="m-0 mt-10 font-[Roboto] text-[20px] font-semibold leading-[23px] text-[#292727] lg:mt-[50px]">
          Recommended Service Providers
        </h2>
        <p className="m-0 mt-4 max-w-[520px] font-[SF_Pro,system-ui,sans-serif] text-[20px] leading-[24px] text-[#484040]">
          Matched by specialization, customer satisfaction sentiments, ratings and distance from you.
        </p>

        <div className="mt-[41px] overflow-x-auto">
          <div className="grid max-w-[927px] grid-cols-1 gap-x-[31px] gap-y-[21px] xl:grid-cols-2">
            {providers.map((provider) => {
              const selected = selectedIds.has(provider.id);
              return (
                <button
                  key={provider.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleProvider(provider.id)}
                  className={`relative box-border block h-[187px] w-full min-w-[448px] cursor-pointer rounded-[10px] border bg-white p-0 text-left font-[SF_Pro,system-ui,sans-serif] text-[#484040] ${
                    selected
                      ? 'border-[#689494] shadow-[inset_0_0_0_1px_#689494]'
                      : 'border-[#818080]'
                  }`}
                >
                  {provider.avatarUrl ? (
                    <img
                      src={provider.avatarUrl}
                      alt={provider.name}
                      className="absolute left-[9px] top-[18px] h-[54px] w-[54px] rounded-full object-cover"
                    />
                  ) : (
                    <div className="absolute left-[9px] top-[18px] h-[54px] w-[54px] rounded-full bg-[#D9D9D9]" />
                  )}

                  <p className="absolute left-[77px] top-[22px] m-0 text-[13px] font-bold leading-[16px]">
                    {provider.name}
                  </p>
                  <p className="absolute left-[77px] top-[46px] m-0 text-[12px] leading-[14px]">
                    {provider.category}
                  </p>

                  <div className="absolute right-[14px] top-[22px] flex gap-2">
                    {provider.verified && (
                      <span className="flex h-[28px] w-[118px] items-center rounded-[10px] bg-[rgba(87,127,187,0.46)] pl-1 text-[12px] leading-[14px] text-[#0255AF]">
                        <CheckBadgeIcon />
                        <span className="ml-[11px]">Verified</span>
                      </span>
                    )}
                    {provider.available && (
                      <span className="flex h-[28px] w-[110px] items-center justify-center rounded-[10px] bg-[#86FF8A] text-[12px] leading-[14px] text-[#167713]">
                        Available
                      </span>
                    )}
                  </div>

                  <div className="absolute left-[72px] top-[72px] flex items-center text-[12px] leading-[14px]">
                    <img src={starIcon} alt="" className="h-[27px] w-[27px]" />
                    <div className="ml-2 flex -translate-y-[2px] items-center">
                      <span>{provider.rating}</span>
                      <span className="ml-[31px]">{provider.reviewCount} reviews</span>
                      <span className="ml-[35px]">{provider.yearsExperience} years experience</span>
                    </div>
                  </div>

                  <div className="absolute left-[76px] top-[109px] text-[12px] leading-[14px]">
                    <p className="m-0">
                      <span className="font-bold">Specialities:</span> {provider.specialities}
                    </p>
                    <p className="m-0">
                      <span className="font-bold">Location:</span> {provider.location}
                    </p>
                    <p className="m-0">
                      <span className="font-bold">Available:</span> {provider.availability}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-12 flex max-w-[927px] flex-col items-center lg:mt-[49px]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIds.size === 0}
            className="box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit Service Request
          </button>
          <button
            type="button"
            onClick={handleFindAnother}
            className="mt-[18px] cursor-pointer border-0 bg-transparent p-0 font-[Quicksand] text-[16px] font-medium leading-[20px] text-[#3C3A3A] underline"
          >
            Find another Service Provider
          </button>
        </div>
      </div>
    </CustomerSidebar>
  );
}