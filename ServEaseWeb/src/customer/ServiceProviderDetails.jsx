import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import starIcon from '../assets/icon_star.png';
import { openChat } from '../components/MessagingWidget.jsx';
import {
  clearDraftRequestId,
  getDraftRequestId,
  getServiceProviderDetails,
  submitServiceRequest,
} from '../api/client';

// 2.5 -> "2.5 km away" (empty when the backend sends no distance)
const formatDistance = (km) =>
  km != null && km !== '' && !Number.isNaN(Number(km)) ? `${Number(km).toFixed(1)} km away` : '';

// The provider's location comes from the provider's own account (stored by the backend).
// It may arrive ready-made (locationName / address / location) or as separate parts
// (street, barangay, city, ...). Whatever arrives is shown; nothing is invented here.
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const resolveLocation = (p = {}) => {
  const direct = [
    p.locationName,
    p.location_name,
    p.address,
    p.companyAddress,
    p.company_address,
    typeof p.location === 'string' ? p.location : '',
  ]
    .map(clean)
    .find(Boolean);
  if (direct) return direct;
  const src = p.location && typeof p.location === 'object' ? p.location : p;
  return [src.street, src.barangay, src.city, src.municipality, src.province]
    .map(clean)
    .filter(Boolean)
    .join(', ');
};

// Live data: GET /api/service-providers/:id -> { provider }. The backend already
// computes the rating summary, the positive-feedback percentage, the AI summary
// tags, and masks the reviewer names. Mapped here onto the shape the JSX uses.
const toProviderView = (p) => ({
  id: p.id,
  name: p.name,
  title: p.title || p.specialty || p.category || '',
  workplace: p.workplace || p.companyName || p.company_name || '',
  avatarUrl: p.photoUrl || null,
  verified: Boolean(p.verified),
  available: Boolean(p.available),
  yearsExperience: p.experienceYears ?? p.yearsOfExperience ?? 0,
  specialities: p.specialities || '',
  location: [resolveLocation(p), formatDistance(p.distanceKm)].filter(Boolean).join(' · '),
  availability: p.availabilitySchedule || (p.offersHomeServices ? 'Offers home services' : ''),
  positiveFeedbackPercent: p.positiveFeedbackPercent,
  aiSummaryTags: p.aiSummaryTags || [],
  rating: p.rating,
  reviewCount: p.reviewCount || 0,
  reviews: (p.reviews || []).map((r, i) => ({
    id: r.id ?? r.rating_id ?? i,
    reviewerName: r.reviewerName || 'Customer',
    rating: Number(r.rating) || 0,
    serviceAvailed: r.serviceAvailed || 'Service',
    comment: r.comment ?? r.review ?? '',
  })),
});

function CheckBadgeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#0255AF" />
      <path d="M6.8 12.6l3.5 3.5 6.9-7.4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// "Label: value" line in the details list; skipped when the backend sends no value.
function DetailLine({ label, value }) {
  if (!value) return null;
  return (
    <p className="m-0">
      <span className="font-bold">{label}:</span> {value}
    </p>
  );
}

const CTA_CLASS =
  'box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white disabled:cursor-not-allowed disabled:opacity-60';

export default function ServiceProviderDetails() {
  const navigate = useNavigate();

  // The provider id comes from the route set up by FindServiceProvider.jsx, e.g.
  // <Route path="/customer/providers/:providerId" element={<ServiceProviderDetails />} />
  const { providerId } = useParams();

  const [provider, setProvider] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getServiceProviderDetails(providerId)
      .then((data) => {
        if (cancelled) return;
        setProvider(toProviderView(data.provider));
        setStatus('done');
      })
      .catch(() => {
        if (!cancelled) setStatus('error'); // e.g. provider not found (404)
      });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  // Opens the chat popup with this provider (only possible once a service request
  // connects the two accounts — the backend ties conversations to requests).
  const handleMessage = () => {
    openChat({ id: provider.id, name: provider.name });
  };

  // If a draft request is in progress (the customer came from the create-request
  // flow), submit it to this provider; otherwise start a new request first.
  const handleChoose = async () => {
    const draftId = getDraftRequestId();
    if (!draftId) {
      navigate('/customer/requests/new');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await submitServiceRequest(draftId, [provider.id]);
      clearDraftRequestId();
      navigate('/customer/requests/new/request-submitted', {
        state: { requestId: draftId, providers: [{ id: provider.id, name: provider.name }] },
      });
    } catch (err) {
      setActionError(err.message || 'Could not send the request. Please try again.');
      setBusy(false);
    }
  };

  if (status !== 'done' || !provider) {
    return (
      <CustomerSidebar>
        <div className="box-border px-4 pb-10 pt-8 font-[SF_Pro,system-ui,sans-serif] text-[#484040] sm:px-[59px]">
          <p
            role={status === 'error' ? 'alert' : undefined}
            className={`m-0 py-16 text-center text-[14px] ${status === 'error' ? 'text-[#B91C1C]' : 'text-[#817C7C]'}`}
          >
            {status === 'error'
              ? 'Could not load this service provider.'
              : 'Loading service provider…'}
          </p>
        </div>
      </CustomerSidebar>
    );
  }

  const hasFeedback = provider.positiveFeedbackPercent != null;

  return (
    <CustomerSidebar>
      <div className="box-border px-4 pb-10 pt-8 font-[SF_Pro,system-ui,sans-serif] text-[#484040] sm:px-[59px] sm:pt-[45px]">
        <div className="max-w-[1079px]">
          <div className="flex flex-col lg:flex-row">
            {/* Left column: avatar + name/badges, then experience and details underneath */}
            <div className="flex-none lg:w-[482px]">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-[21px]">
                {provider.avatarUrl ? (
                  <img
                    src={provider.avatarUrl}
                    alt={provider.name}
                    className="h-[144px] w-[144px] flex-none rounded-full object-cover"
                  />
                ) : (
                  <div className="h-[144px] w-[144px] flex-none rounded-full bg-[#D9D9D9]" />
                )}

                <div className="min-w-0 sm:pt-[27px]">
                  <h1 className="m-0 text-[20px] font-bold leading-[24px]">{provider.name}</h1>
                  {provider.title && (
                    <p className="m-0 mt-[6px] text-[13px] leading-[16px]">{provider.title}</p>
                  )}

                  <div className="mt-[13px] flex flex-wrap items-center gap-[5px] text-[12px] leading-[14px]">
                    {provider.verified && (
                      <span className="relative flex h-[32px] w-[113px] items-center rounded-[52px] bg-[rgba(87,127,187,0.46)] pl-[32px] text-[#0255AF]">
                        <span className="absolute left-[14px] top-[6px]">
                          <CheckBadgeIcon />
                        </span>
                        Verified
                      </span>
                    )}
                    {provider.available && (
                      <span className="flex h-[32px] w-[100px] items-center justify-center rounded-[29px] bg-[#86FF8A] text-[#167713]">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 sm:mt-[46px] sm:pl-[34px]">
                <p className="m-0 text-[15px] font-bold leading-[18px]">
                  {provider.yearsExperience} {Number(provider.yearsExperience) === 1 ? 'year' : 'years'} experience
                </p>
                <div className="mt-[11px] text-[14px] leading-[30px]">
                  <DetailLine label="Specialities" value={provider.specialities} />
                  <DetailLine label="Location" value={provider.location} />
                  <DetailLine label="Available" value={provider.availability} />
                  <DetailLine label="Workplace" value={provider.workplace} />
                </div>
              </div>
            </div>

            {/* Right column: positive feedback + AI summary tags */}
            {(hasFeedback || provider.aiSummaryTags.length > 0) && (
              <div className="mt-8 min-w-0 lg:mt-[208px]">
                {hasFeedback && (
                  <p className="m-0 text-[15px] font-bold leading-[18px]">
                    {provider.positiveFeedbackPercent}% Positive Feedback
                  </p>
                )}

                {provider.aiSummaryTags.length > 0 && (
                  <div className={hasFeedback ? 'mt-[23px]' : ''}>
                    <p className="m-0 text-[15px] font-bold leading-[18px]">AI Summary Insights</p>
                    <div className="mt-[17px] flex flex-wrap gap-[6px]">
                      {provider.aiSummaryTags.map((tag) => (
                        <span
                          key={tag}
                          className="box-border flex h-[29px] items-center justify-center rounded-[20px] border border-[#818080] bg-white px-[18px] text-[14px] leading-[17px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rating summary */}
          <div className="mt-8 flex items-center text-[14px] leading-[17px] lg:mt-[53px]">
            <img src={starIcon} alt="" className="h-[21px] w-[21px]" />
            <span className="ml-[6px]">{provider.rating ?? 'New'}</span>
            <span className="ml-[15px]">{provider.reviewCount} reviews</span>
          </div>

          {/* Reviews */}
          <div className="ml-[3px] mt-5 flex max-w-[1076px] flex-col gap-[7px]">
            {provider.reviews.map((review) => (
              <div
                key={review.id}
                className="box-border min-h-[83px] rounded-[10px] border border-[#818080] bg-white px-[14px] py-[13px]"
              >
                <p className="m-0 text-[12px] leading-[14px]">{review.reviewerName}</p>
                <div className="mt-[1px] flex gap-[5px]">
                  {Array.from({ length: review.rating }, (_, i) => (
                    <img key={i} src={starIcon} alt="" className="h-[14px] w-[14px]" />
                  ))}
                </div>
                <p className="m-0 mt-[2px] text-[10px] leading-[12px]">
                  Service Availed: {review.serviceAvailed}
                </p>
                {review.comment && (
                  <p className="m-0 mt-[5px] text-[9px] leading-[11px]">{review.comment}</p>
                )}
              </div>
            ))}
          </div>

          {/* Actions: Choose (348px) + Message (348px), 29px apart */}
          <div className="mt-[60px] flex flex-col items-center lg:mt-[118px]">
            {actionError && (
              <p role="alert" className="m-0 mb-3 text-center text-[12px] text-[#B91C1C]">
                {actionError}
              </p>
            )}
            <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-[29px]">
              <button type="button" onClick={handleChoose} disabled={busy} className={CTA_CLASS}>
                {busy ? 'Sending…' : 'Choose this Service Provider'}
              </button>
              <button type="button" onClick={handleMessage} className={CTA_CLASS}>
                Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </CustomerSidebar>
  );
}