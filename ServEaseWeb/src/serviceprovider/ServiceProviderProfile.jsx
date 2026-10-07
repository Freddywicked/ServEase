import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import * as api from '../api/client';
import { useAuth } from '../context/auth_context';
import avatarCircle from '../assets/icon_bigellipse.png';
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

// ── Availability from the provider's calendar ─────────────────────────────
// The provider manages availability on the dashboard ("Manage your Calendar"): they block
// dates / time slots. The profile shows a summary of that saved data.

// Keep in sync with TIME_SLOTS in ServiceProviderDashboard.jsx (the provider's working hours).
const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_AHEAD = 7; // the summary looks at the next 7 days, starting today

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// '08:00 AM' -> { hour24: 8 }
const slotHour24 = (slot) => {
  const [time, meridiem] = slot.split(' ');
  const hour = Number(time.split(':')[0]) % 12;
  return meridiem === 'PM' ? hour + 12 : hour;
};

const formatHour = (hour24) => {
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:00 ${meridiem}`;
};

// Working hours covered by the time slots, e.g. '8:00 AM - 5:00 PM' (each slot is one hour).
const getWorkingHours = () => {
  if (TIME_SLOTS.length === 0) return '';
  const start = slotHour24(TIME_SLOTS[0]);
  const end = slotHour24(TIME_SLOTS[TIME_SLOTS.length - 1]) + 1;
  return `${formatHour(start)} - ${formatHour(end)}`;
};

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

// availabilityByDate: { '2026-10-05': { '10:00 AM': 'unavailable' } } (same shape the calendar
// uses). A day counts as available when at least one of its time slots is not blocked.
const summarizeAvailability = (availabilityByDate, today = new Date()) => {
  const availableDays = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const blocked = availabilityByDate?.[toDateKey(date)] || {};
    const hasFreeSlot = TIME_SLOTS.some((slot) => blocked[slot] !== 'unavailable');
    if (hasFreeSlot) availableDays.push(WEEKDAYS[(date.getDay() + 6) % 7]);
  }
  return {
    days: availableDays.length > 0 ? formatDayRanges(availableDays) : 'Not available this week',
    hours: getWorkingHours(),
  };
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
function ProfileBanner({ name, onEdit }) {
  const letter = (name || '').trim()[0]?.toUpperCase() || '';
  return (
    <div className="relative">
      <div className="box-border h-[142px] rounded-b-[1px] rounded-t-[10px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />
      <div className="relative box-border h-[82px] rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF]">
        <p className="absolute left-[189px] top-[18px] m-0 max-w-[calc(100%-420px)] truncate font-[Quicksand] text-[24px] font-bold leading-[30px] text-[#292727]">
          {name}
        </p>
        <EditButton onClick={onEdit} className="absolute right-[34px] top-[21px]" />
      </div>

      <div className="absolute left-[27px] top-[82px] flex h-[121px] w-[121px] items-center justify-center">
        <img src={avatarCircle} alt="" className="absolute inset-0 h-full w-full" />
        <span className="relative font-[Inter] text-[64px] font-bold leading-[77px] text-white">{letter}</span>
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
  const [provider, setProvider] = useState(undefined); // undefined = still loading, null = never applied
  const [availabilityByDate, setAvailabilityByDate] = useState(null); // null = not loaded
  const [account, setAccount] = useState(null); // user fields returned by GET /api/me (may have more than useAuth)
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

  // Availability the provider saved from "Manage your Calendar" on the dashboard. Fetched every
  // time the profile opens, so changes made on the calendar show up here.
  // Needs api/client.js to export getProviderAvailability({ from, to }) that calls the same
  // backend availability data the calendar saves to (e.g. GET /api/provider/availability) and
  // resolves to { 'YYYY-MM-DD': { '10:00 AM': 'unavailable' } }.
  useEffect(() => {
    if (!provider) return undefined;
    const loadAvailability = api.getProviderAvailability;
    if (typeof loadAvailability !== 'function') {
      if (import.meta.env.DEV) {
        console.warn('[profile] api/client.js has no getProviderAvailability(); availability not loaded.');
      }
      return undefined;
    }
    let cancelled = false;
    const today = new Date();
    const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD - 1);
    loadAvailability({ from: toDateKey(today), to: toDateKey(last) })
      .then((result) => {
        if (!cancelled) setAvailabilityByDate(result || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    // TODO (backend-ready): fetch this provider's feedback summary and recent reviews, then
    // call setFeedback(...) with the shape described above, e.g.
    //
    //   // let cancelled = false;
    //   // api.getProviderFeedback()                  // GET /api/provider/feedback
    //   //   .then((result) => { if (!cancelled) setFeedback(result); })
    //   //   .catch(() => {});
    //   // return () => { cancelled = true; };
    //
    // The AI Summary Insights tags should be generated server-side from the reviews, and
    // reviewer names should be masked server-side.
  }, [user]);

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
  // Prefer the calendar data; fall back to availability columns on the provider record, if any.
  const availability =
    availabilityByDate !== null ? summarizeAvailability(availabilityByDate) : getAvailability(provider);
  const availabilityLines = [availability.days, availability.hours].filter(Boolean);

  const handleEditProfile = () => {
    // TODO (backend-ready): open the edit form for the profile (name / photo), then save it, e.g.
    // await api.updateProfile({ name });   // PATCH /api/me
    console.log('Edit profile clicked');
  };

  const handleEditAccount = () => {
    // TODO (backend-ready): open the edit form for the account details, then save it, e.g.
    // await api.updateProfile({ email, phone, address });   // PATCH /api/me
    console.log('Edit account details clicked');
  };

  const handleEditOther = () => {
    // TODO (backend-ready): open the edit form for the services, availability and service
    // address, then save it, e.g.
    // await api.updateProviderProfile({ services, availability, address });   // PATCH /api/provider
    console.log('Edit other details clicked');
  };

  return (
    <ServiceProviderSidebar>
      <div className="box-border min-w-[820px] px-4 pb-[56px] pt-6 sm:pl-[31px] sm:pr-[66px]">
        <h1 className="m-0 flex min-h-[68px] items-center pl-[23px] font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        <div className="mt-[17px]">
          <ProfileBanner name={user.name} onEdit={handleEditProfile} />
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