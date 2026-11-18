import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import * as api from '../api/client';
import { useAuth } from '../context/auth_context';
import starIcon from '../assets/icon_star.png';

// Returns the first non-empty value found under any of the given keys of `source`.
// Account fields are read from the logged-in user (useAuth) and the provider application
// (GET /api/me -> data.provider). If your backend names them differently, only the key lists
// and the small helpers in this file need to change.
const pickFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return '';
};

const MOBILE_KEYS = [
  'phone',
  'phone_number',
  'phoneNumber',
  'mobile_number',
  'mobileNumber',
  'mobile',
  'mobile_no',
  'contact_number',
  'contactNumber',
  'contact_no',
  'contact',
];
const ADDRESS_KEYS = ['address', 'address_details', 'addressDetails', 'location'];

// Turns whatever the backend stores for a list of services into a clean string[]:
// a real array, a JSON string ('["Phone repair"]') or a comma separated string.
const toList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.name ?? item?.label ?? item?.category))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      return toList(JSON.parse(value));
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const SERVICE_KEYS = [
  'services',
  'service_categories',
  'serviceCategories',
  'selected_categories',
  'selectedCategories',
  'categories',
  'specialties',
  'specialities',
  'other_service',
  'otherService',
  'other_services',
  'otherServices',
  'home_repair_services',
  'homeRepairServices',
];

// Last resort when the backend uses names that are not listed above: look at every key of the
// record whose name matches `pattern` (ids, statuses and timestamps are skipped).
const SKIP_KEYS = /(^|_)id$|status|verif|_at$|created|updated|password|token|offer/i;
const valuesByKeyPattern = (record, pattern) =>
  Object.entries(record || {})
    .filter(([key]) => pattern.test(key) && !SKIP_KEYS.test(key))
    .map(([, value]) => value);

const firstText = (values) => {
  const found = values.find(
    (value) => (typeof value === 'string' || typeof value === 'number') && String(value).trim() !== ''
  );
  return found === undefined ? '' : String(found);
};

// Services the provider applied with (selected categories + the services they typed in).
const getServices = (provider) => {
  const known = SERVICE_KEYS.flatMap((key) => toList(provider?.[key]));
  const all =
    known.length > 0
      ? known
      : valuesByKeyPattern(provider, /categor|service|speciali?t/i).flatMap(toList);
  return [...new Set(all)];
};

// Supports availability as { days, hours }, as a string (or JSON string), or as separate columns.
const getAvailability = (provider) => {
  let source = provider?.availability ?? provider?.schedule;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return { days: source.trim(), hours: '' };
    }
  }
  const days =
    source?.days ??
    provider?.available_days ??
    provider?.availability_days ??
    provider?.working_days ??
    '';
  const hours =
    source?.hours ??
    provider?.available_hours ??
    provider?.availability_hours ??
    provider?.working_hours ??
    '';
  if (days || hours) return { days, hours };

  // Fallback: any text field that looks like an availability / schedule column.
  const texts = valuesByKeyPattern(provider, /avail|schedule|working/i).filter(
    (value) => typeof value === 'string' && value.trim() !== '' && !/^(true|false|0|1)$/i.test(value.trim())
  );
  return { days: texts[0] ?? '', hours: texts[1] ?? '' };
};

// ── Availability = the provider's working hours ──────────────────────────
// Set on the Edit Profile screen (days + start/end time, e.g. a shop that opens 10:00 AM -
// 6:00 PM, or a freelancer's own hours). It is NOT the calendar: the time slots under
// "Manage your Calendar" are the universal appointment slots, and a provider can still accept
// a request outside their working hours.

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ['Monday','Tuesday','Wednesday','Friday'] -> 'Monday - Wednesday, Friday'
const formatDayRanges = (days) => {
  const indexes = WEEKDAYS.map((day, i) => (days.includes(day) ? i : -1)).filter((i) => i >= 0);
  const ranges = [];
  let runStart = null;
  indexes.forEach((index, position) => {
    if (runStart === null) runStart = index;
    const isEndOfRun = indexes[position + 1] !== index + 1;
    if (isEndOfRun) {
      ranges.push(runStart === index ? WEEKDAYS[index] : `${WEEKDAYS[runStart]} - ${WEEKDAYS[index]}`);
      runStart = null;
    }
  });
  return ranges.join(', ');
};

// GET /api/providers/me/profile -> other: { availabilityDays: ['Mon', ...] | null,
// availabilityHours: '10:00 AM - 6:00 PM' | null }
const buildWorkingHours = (other) => {
  const days = (Array.isArray(other?.availabilityDays) ? other.availabilityDays : [])
    .map((value) => WEEKDAYS.find((day) => day.slice(0, 3).toLowerCase() === String(value).slice(0, 3).toLowerCase()))
    .filter(Boolean);
  return { days: formatDayRanges(days), hours: other?.availabilityHours || '' };
};

function EditButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`box-border h-[39px] w-[109px] cursor-pointer rounded-[10px] border border-[#3F4143] bg-white p-0 font-[SF_Pro,system-ui,sans-serif] text-[16px] font-bold leading-[27px] text-black ${className}`}
    >
      Edit
    </button>
  );
}

// Blue banner + white strip with the avatar, name and Edit button.
// photoUrl is the signed URL from GET /api/providers/me/profile, with the account
// photo (user.photoUrl) as fallback; UserAvatar shows the initial when there is no photo.
function ProfileBanner({ name, photoUrl, onEdit }) {
  return (
    <div className="relative">
      <div className="box-border h-[142px] rounded-b-[1px] rounded-t-[10px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />
      <div className="relative box-border h-[82px] rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF]">
        <p className="absolute left-[189px] top-[18px] m-0 max-w-[calc(100%-420px)] truncate font-[Quicksand] text-[24px] font-bold leading-[30px] text-[#292727]">
          {name}
        </p>
        <EditButton onClick={onEdit} className="absolute right-[34px] top-[21px]" />
      </div>

      {/* Positioned wrapper keeps the avatar overlapping the banner; UserAvatar itself
          renders in normal flow inside it. */}
      <div className="absolute left-[27px] top-[82px]">
        <UserAvatar
          name={name}
          src={photoUrl}
          sizeClass="h-[121px] w-[121px]"
          textClass="text-[64px] leading-[77px]"
        />
      </div>
    </div>
  );
}

// A label (optional) with one or more bold value lines, placed inside a details card.
function Field({ label, lines, left, valueTop = 93, lineGap = 0 }) {
  return (
    <div className="absolute font-[SF_Pro,system-ui,sans-serif] text-[16px] leading-[27px]" style={{ left }}>
      {label && (
        <p className="absolute m-0 whitespace-nowrap text-[#484040]" style={{ top: 69 }}>
          {label}
        </p>
      )}
      <div className="absolute max-w-[240px]" style={{ top: valueTop }}>
        {lines.length > 0 ? (
          lines.map((line, index) => (
            <p
              key={line}
              className="m-0 truncate font-bold text-black"
              style={index > 0 ? { marginTop: lineGap } : undefined}
            >
              {line}
            </p>
          ))
        ) : (
          <p className="m-0 font-bold text-black">—</p>
        )}
      </div>
    </div>
  );
}

function DetailsCard({ title, onEdit, children }) {
  return (
    <section className="relative box-border h-[173px] rounded-[10px] border border-black/[0.46] bg-[#FDFFFF]">
      <h2 className="absolute left-[26px] top-[20px] m-0 font-[Quicksand] text-[20px] font-bold leading-[25px] text-[#292727]">
        {title}
      </h2>
      {children}
      <EditButton onClick={onEdit} className="absolute bottom-[20px] right-[34px]" />
    </section>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="box-border h-[83px] w-[350px] max-w-full rounded-[10px] border border-[#818080] bg-white px-[10px] pt-[10px] font-[SF_Pro,system-ui,sans-serif] text-[#484040]">
      <p className="m-0 text-[11px] leading-[13px]">{review.reviewerName}</p>
      <div className="mt-px flex">
        {Array.from({ length: review.rating ?? 0 }, (_, i) => (
          <img key={i} src={starIcon} alt="" className="h-[11px] w-[11px]" />
        ))}
      </div>
      <p className="m-0 mt-[3px] text-[9px] leading-[11px]">Service Availed: {review.serviceAvailed}</p>
      <p className="m-0 mt-[3px] max-w-[188px] text-[8px] leading-[10px]">{review.comment}</p>
    </div>
  );
}

export default function ServiceProviderProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [provider, setProvider] = useState(undefined); // undefined = still loading, null = never applied
  const [workingHours, setWorkingHours] = useState(null); // { days, hours } from the profile endpoint; null = not loaded
  const [account, setAccount] = useState(null); // user fields returned by GET /api/me (may have more than useAuth)
  const [providerPhotoUrl, setProviderPhotoUrl] = useState(null); // signed URL from GET /api/providers/me/profile
  const [loadError, setLoadError] = useState('');

  // Feedback summary + reviews for this provider.
  // Expected shape (adjust to the real API contract):
  //   {
  //     positiveFeedbackPercent: number | null,   // e.g. 92
  //     rating: number,                           // e.g. 4.8
  //     reviewCount: number,                      // e.g. 95
  //     insights: string[],                       // AI Summary Insights chips, e.g. ['Professional', 'On Time']
  //     reviews: [{ id, reviewerName (masked), rating, serviceAvailed, comment }],
  //   }
  const [feedback, setFeedback] = useState({
    positiveFeedbackPercent: null,
    rating: 0,
    reviewCount: 0,
    insights: [],
    reviews: [],
  });

  // Load this account's provider application from the backend.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api
      .me()
      .then((data) => {
        if (cancelled) return;
        // Dev-only: shows exactly which fields the backend returns, to match the key lists above.
        if (import.meta.env.DEV) console.debug('[profile] GET /api/me ->', data);
        setAccount(data.user || null);
        setProvider(data.provider || null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Couldn't load your account.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // The provider photo is stored on the provider record (service_providers.profile_photo),
  // not in users.photo_url, so GET /api/auth/me cannot supply it. Use the same provider
  // profile endpoint as the mobile app and keep the account photo as a fallback.
  useEffect(() => {
    if (!provider) return undefined;
    let cancelled = false;
    api
      .getMyProviderProfile()
      .then((data) => {
        if (cancelled) return;
        setProviderPhotoUrl(data?.photoUrl || null);
        setWorkingHours(buildWorkingHours(data?.other));
      })
      .catch(() => {}); // keep the account photo / initial fallback when unavailable
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // The feedback summary (rating, review count, masked reviews, AI insights) is the
  // same data ServiceProviderDetails.jsx shows customers, fetched for this provider's
  // own id. Only verified providers have reviews/ratings, so this is skipped otherwise.
  useEffect(() => {
    if (!provider || provider.verification_status !== 'verified') return undefined;
    let cancelled = false;
    api
      .getServiceProviderDetails(user.user_id)
      .then((data) => {
        if (cancelled) return;
        const p = data.provider;
        setFeedback({
          positiveFeedbackPercent: p.positiveFeedbackPercent ?? null,
          rating: p.rating ?? 0,
          reviewCount: p.reviewCount ?? 0,
          insights: p.aiSummaryTags || [],
          reviews: (p.reviews || []).map((r, i) => ({
            id: r.id ?? i,
            reviewerName: r.reviewerName || 'Customer',
            rating: Number(r.rating) || 0,
            serviceAvailed: r.serviceAvailed || 'Service',
            comment: r.comment ?? r.review ?? '',
          })),
        });
      })
      .catch(() => {}); // no reviews yet / not found — the placeholder stays
    return () => {
      cancelled = true;
    };
  }, [provider, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (loadError) {
    return <p className="m-0 p-6 font-[Roboto] text-[14px] text-[#B91C1C]">{loadError}</p>;
  }
  if (provider === undefined) return null;
  // No provider application on this account: send them to choose a role / apply.
  if (provider === null) return <Navigate to="/role-selection" replace />;

  const profile = { ...user, ...(account || {}) };
  const mobile =
    pickFirst(profile, MOBILE_KEYS) ||
    pickFirst(provider, MOBILE_KEYS) ||
    firstText([
      ...valuesByKeyPattern(profile, /phone|mobile|contact/i),
      ...valuesByKeyPattern(provider, /phone|mobile|contact/i),
    ]);
  const address = pickFirst(profile, ADDRESS_KEYS);
  const providerAddress = pickFirst(provider, ADDRESS_KEYS) || address;
  const services = getServices(provider);
  // Working hours saved on the Edit Profile screen; the provider record's text column until loaded.
  const availability = workingHours ?? getAvailability(provider);
  const availabilityLines = [availability.days, availability.hours].filter(Boolean);

  // All three Edit buttons open the same edit screen (ServiceProviderEditProfile.jsx), which
  // loads and saves the photo, account details, availability and company details.
  const goToEditProfile = () => navigate('/serviceprovider/profile/edit');
  const handleEditProfile = goToEditProfile;
  const handleEditAccount = goToEditProfile;
  const handleEditOther = goToEditProfile;

  return (
    <ServiceProviderSidebar>
      <div className="box-border min-w-[820px] px-4 pb-[56px] pt-6 sm:pl-[31px] sm:pr-[66px]">
        <h1 className="m-0 flex min-h-[68px] items-center pl-[23px] font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        <div className="mt-[17px]">
          <ProfileBanner name={user.name} photoUrl={providerPhotoUrl || profile.photoUrl} onEdit={handleEditProfile} />
        </div>

        <div className="font-[SF_Pro,system-ui,sans-serif] text-[#484040]">
          <p className="m-0 mt-[22px] text-center text-[15px] font-bold leading-[18px]">
            {feedback.positiveFeedbackPercent !== null
              ? `${feedback.positiveFeedbackPercent}% Positive Feedback`
              : 'No feedback yet'}
          </p>

          <div className="mt-[25px] flex h-[25px] items-center">
            <p className="m-0 pl-[14px] text-[15px] font-bold leading-[18px]">AI Summary Insights</p>
            <div className="ml-[29px] flex gap-[14px]">
              {feedback.insights.length > 0 ? (
                feedback.insights.map((tag) => (
                  <span
                    key={tag}
                    className="box-border flex h-[25px] min-w-[103px] items-center justify-center rounded-[10px] border border-[#818080] bg-white px-3 text-center text-[13px] leading-[16px]"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[13px] leading-[16px] text-[#817C7C]">Not enough reviews yet</span>
              )}
            </div>
          </div>

          <div className="mt-[33px] flex h-[21px] items-center pl-1 text-[12px] leading-[14px]">
            <img src={starIcon} alt="" className="h-[21px] w-[21px]" />
            <span className="ml-[6px]">{feedback.rating}</span>
            <span className="ml-5">{feedback.reviewCount} reviews</span>
          </div>

          <div className="mt-[7px] flex flex-wrap gap-[10px]">
            {feedback.reviews.length > 0 ? (
              feedback.reviews.map((review) => <ReviewCard key={review.id} review={review} />)
            ) : (
              <p className="m-0 text-[12px] text-[#817C7C]">No reviews yet.</p>
            )}
          </div>
        </div>

        <div className="mt-[36px]">
          <DetailsCard title="Account Details" onEdit={handleEditAccount}>
            <Field label="Email Address" lines={user.email ? [user.email] : []} left={27} />
            <Field label="Mobile Number" lines={mobile ? [mobile] : []} left={292} />
            <Field label="Address Details" lines={address ? [address] : []} left={516} />
          </DetailsCard>
        </div>

        <div className="mt-[24px]">
          <DetailsCard title="Other Details" onEdit={handleEditOther}>
            <Field lines={services} left={27} valueTop={96} />
            <Field label="Availability" lines={availabilityLines} left={292} lineGap={3} />
            <Field label="Address Details" lines={providerAddress ? [providerAddress] : []} left={516} />
          </DetailsCard>
        </div>

        {/* DEV ONLY: raw account data from GET /api/me, to see which fields the backend returns.
            Remove this block once the profile fields show correctly. */}
        {import.meta.env.DEV && (
          <details className="mt-6 font-[Roboto] text-[12px] text-[#484040]">
            <summary className="cursor-pointer">Debug: raw /api/me data (dev only)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-[#F3F3F3] p-3 text-[11px]">
              {JSON.stringify({ user: account, provider }, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </ServiceProviderSidebar>
  );
}