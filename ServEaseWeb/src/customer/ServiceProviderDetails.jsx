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

// Live data: GET /api/service-providers/:id -> { provider }. The backend already
// computes the rating summary, the positive-feedback percentage, the AI summary
// tags, and masks the reviewer names. Mapped here onto the shape the JSX uses:
//   { id, name, title, avatarUrl, verified, available, yearsExperience, specialities,
//     location, availability, positiveFeedbackPercent, aiSummaryTags, rating,
//     reviewCount, reviews: [{ id, reviewerName, rating, serviceAvailed, comment }] }
const toProviderView = (p) => ({
  id: p.id,
  name: p.name,
  title: p.workplace ? `${p.specialty} — ${p.workplace}` : p.specialty,
  avatarUrl: p.photoUrl || null,
  verified: Boolean(p.verified),
  available: Boolean(p.available),
  yearsExperience: p.experienceYears ?? 0,
  specialities: p.specialities || '',
  location: p.locationName || '',
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

export default function ServiceProviderDetails() {
  const navigate = useNavigate();

  // The provider id comes from the route set up by FindServiceProvider.jsx, e.g.
  // <Route path="/customer/providers/:providerId" element={<ServiceProviderDetails />} />
  const { providerId } = useParams();

  // Fetched provider profile (see toProviderView above). null = still loading.
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
      navigate('/customer/requests/new/request-submitted');
    } catch (err) {
      setActionError(err.message || 'Could not send the request. Please try again.');
      setBusy(false);
    }
  };

  if (status !== 'done' || !provider) {
    return (
      <CustomerSidebar>
        <div className="box-border flex flex-col items-center px-4 pb-10 pt-[22px] font-[SF_Pro,system-ui,sans-serif] text-[#484040] sm:px-9">
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

  return (
    <CustomerSidebar>
      <div className="box-border flex flex-col items-center px-4 pb-10 pt-[22px] font-[SF_Pro,system-ui,sans-serif] text-[#484040] sm:px-9">
        {provider.avatarUrl ? (
          <img
            src={provider.avatarUrl}
            alt={provider.name}
            className="h-[144px] w-[144px] rounded-full object-cover"
          />
        ) : (
          <div className="h-[144px] w-[144px] rounded-full bg-[#D9D9D9]" />
        )}

        <h1 className="m-0 mt-[22px] text-center text-[16px] font-bold leading-[19px]">{provider.name}</h1>
        <p className="m-0 mt-[13px] text-center text-[12px] leading-[14px]">{provider.title}</p>

        <div className="mt-[17px] flex flex-wrap items-center justify-center gap-3 text-[12px] leading-[14px]">
          {provider.verified && (
            <span className="relative flex h-[32px] w-[131px] items-center justify-center rounded-[52px] bg-[rgba(87,127,187,0.46)] text-[#0255AF]">
              <span className="absolute left-[15px] top-[7px]">
                <CheckBadgeIcon />
              </span>
              Verified
            </span>
          )}
          {provider.available && (
            <span className="flex h-[32px] w-[123px] items-center justify-center rounded-[29px] bg-[#86FF8A] text-[#167713]">
              Available
            </span>
          )}
          <button
            type="button"
            onClick={handleMessage}
            className="w-[83px] cursor-pointer border-0 bg-transparent p-0 text-center font-[SF_Pro,system-ui,sans-serif] text-[12px] font-bold leading-[14px] text-[#18315B]"
          >
            Message
          </button>
        </div>

        <p className="m-0 mt-[17px] text-center text-[15px] leading-[18px]">
          {provider.yearsExperience} years experience
        </p>

        <div className="mt-[9px] text-center text-[14px] leading-[17px]">
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

        {provider.positiveFeedbackPercent != null && (
          <p className="m-0 mt-[15px] text-center text-[12px] font-bold leading-[14px]">
            {provider.positiveFeedbackPercent}% Positive Feedback
          </p>
        )}

        <div className="mt-[26px] flex w-full max-w-[350px] flex-col">
          <p className="m-0 pl-[7px] text-[12px] font-bold leading-[14px]">AI Summary Insights</p>

          <div className="mt-2 flex gap-1 pl-[6px]">
            {provider.aiSummaryTags.map((tag) => (
              <span
                key={tag}
                className="box-border flex h-[21px] w-[98px] items-center justify-center rounded-[10px] border border-[#818080] bg-white text-[9px] leading-[11px]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-[15px] flex items-center pl-1 text-[12px] leading-[14px]">
            <img src={starIcon} alt="" className="h-[21px] w-[21px]" />
            <span className="ml-[6px]">{provider.rating ?? 'New'}</span>
            <span className="ml-5">{provider.reviewCount} reviews</span>
          </div>

          <div className="mt-[7px] flex flex-col gap-[7px]">
            {provider.reviews.map((review) => (
              <div
                key={review.id}
                className="box-border h-[83px] rounded-[10px] border border-[#818080] bg-white px-[10px] pt-[10px]"
              >
                <p className="m-0 text-[11px] leading-[13px]">{review.reviewerName}</p>
                <div className="mt-[1px] flex">
                  {Array.from({ length: review.rating }, (_, i) => (
                    <img key={i} src={starIcon} alt="" className="h-[11px] w-[11px]" />
                  ))}
                </div>
                <p className="m-0 mt-[3px] text-[9px] leading-[11px]">
                  Service Availed: {review.serviceAvailed}
                </p>
                <p className="m-0 mt-[3px] max-w-[188px] text-[8px] leading-[10px]">{review.comment}</p>
              </div>
            ))}
          </div>

          {actionError && (
            <p role="alert" className="m-0 mt-4 text-center text-[12px] text-[#B91C1C]">
              {actionError}
            </p>
          )}
          <button
            type="button"
            onClick={handleChoose}
            disabled={busy}
            className="mx-auto mt-[41px] box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Choose this Service Provider'}
          </button>
        </div>
      </div>
    </CustomerSidebar>
  );
}