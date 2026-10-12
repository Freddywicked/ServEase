import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import starIcon from '../assets/icon_star.png';
import {
  clearDraftRequestId,
  getDraftRequestId,
  getRecommendedProviders,
  submitServiceRequest,
} from '../api/client';

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

// Live data: GET /api/service-requests/:requestId/providers — verified providers,
// those matching the draft request's category first (matchesCategory). Mapped here
// onto the shape the cards below render.
const toProviderCard = (p) => ({
  id: p.id, // the provider's user id — this is what submitServiceRequest expects
  name: p.name,
  category: (p.specializations || [])[0] || 'Service provider',
  // photoUrl is a private storage path unless the server signed it (starts with http)
  avatarUrl: typeof p.photoUrl === 'string' && p.photoUrl.startsWith('http') ? p.photoUrl : null,
  verified: true, // the endpoint only returns verified providers
  available: true,
  rating: p.rating ?? 'New',
  reviewCount: p.reviewCount ?? 0,
  yearsExperience: p.experience ?? 0,
  specialities: (p.specializations || []).join(', '),
  location: p.distanceKm != null ? `${Number(p.distanceKm).toFixed(1)} km away` : '',
  availability: p.offersHomeServices ? 'Offers home services' : '',
  matchesCategory: Boolean(p.matchesCategory),
});

export default function RecommendServiceProvider() {
  const navigate = useNavigate();

  // The draft request created in step 1 (CreateServiceRequest.jsx saved its id).
  // Opened directly (no draft), this screen makes no sense — start over.
  const requestId = getDraftRequestId();

  const [providers, setProviders] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!requestId) return undefined;
    let cancelled = false;
    setStatus('loading');
    getRecommendedProviders(requestId)
      .then((data) => {
        if (cancelled) return;
        const list = (data?.providers ?? []).map(toProviderCard);
        setProviders(list);
        // In the design the top matches start selected (the backend already sorts
        // category matches first, so the first two are the best fit).
        setSelectedIds(new Set(list.slice(0, 2).map((p) => p.id)));
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

  // Clicking a card toggles it; the selected ids are submitted with the request.
  const toggleProvider = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sends the draft request to the chosen providers (POST /:id/submit); it then
  // shows up in their Incoming Service Requests list.
  const handleSubmit = async () => {
    if (submitting || selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitServiceRequest(requestId, [...selectedIds]);
      clearDraftRequestId();
      navigate('/customer/requests/new/request-submitted');
    } catch (err) {
      setSubmitError(err.message || 'Could not submit the request. Please try again.');
      setSubmitting(false);
    }
  };

  // Browse the full provider list instead of the recommended shortlist.
  const handleFindAnother = () => {
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

        {status === 'loading' && (
          <p className="m-0 mt-10 font-[Roboto] text-[14px] text-[#817C7C]">
            Finding recommended service providers…
          </p>
        )}
        {status === 'error' && (
          <p role="alert" className="m-0 mt-10 font-[Roboto] text-[14px] text-[#B91C1C]">
            Could not load recommended providers. Please try again.
          </p>
        )}
        {status === 'done' && providers.length === 0 && (
          <p className="m-0 mt-10 font-[Roboto] text-[14px] text-[#817C7C]">
            No verified service providers available yet — try again later.
          </p>
        )}

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
          {submitError && (
            <p role="alert" className="m-0 mb-3 text-center font-[Roboto] text-[13px] text-[#B91C1C]">
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || submitting}
            className="box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Service Request'}
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