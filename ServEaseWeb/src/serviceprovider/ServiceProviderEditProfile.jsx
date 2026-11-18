import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import UserAvatar from '../components/UserAvatar.jsx';
import * as api from '../api/client';
import { useAuth } from '../context/auth_context';

/*
 * Service Provider - Edit Profile  (route: /serviceprovider/profile/edit)
 *
 * Nothing on this screen is hard-coded. Every value comes from the backend and every change is
 * saved back to it (provider_routes.js / provider_controllers.js):
 *
 *   LOAD  api.getMyProviderProfile()  GET   /api/providers/me/profile
 *           -> { fullName, photoUrl, account: { email, address },
 *                other: { availabilityDays: ['Mon', ...], availabilityHours: '9:00 AM - 5:00 PM',
 *                         companyName, companyAddress } }
 *   SAVE  api.updateMyProviderProfile(changes)  PATCH /api/providers/me/profile
 *           body: any of { email, address, availabilityDays, availabilityHours,
 *                          companyName, companyAddress }  (only changed fields are sent)
 *         api.uploadProviderPhoto(file)         POST  /api/providers/me/photo  (multipart "photo")
 *
 * The only constants below are UI options (weekday names, AM/PM), not user data.
 */

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PERIODS = ['AM', 'PM'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// The backend stores days as 'Mon'..'Sun'; the dropdown shows full names.
const toBackendDay = (day) => day.slice(0, 3);

// ── Availability helpers ──────────────────────────────────────────────────

const sortDays = (days) => WEEKDAYS.filter((day) => days.includes(day));

// ['Monday','Tuesday','Wednesday','Friday'] -> 'Monday - Wednesday, Friday'
const formatDayRanges = (days) => {
  const indexes = WEEKDAYS.map((day, i) => (days.includes(day) ? i : -1)).filter((i) => i >= 0);
  const ranges = [];
  let runStart = null;
  indexes.forEach((index, position) => {
    if (runStart === null) runStart = index;
    if (indexes[position + 1] !== index + 1) {
      ranges.push(runStart === index ? WEEKDAYS[index] : `${WEEKDAYS[runStart]} - ${WEEKDAYS[index]}`);
      runStart = null;
    }
  });
  return ranges.join(', ');
};

// 'Mon', 'mon' or 'Monday' -> 'Monday'
const matchWeekday = (text) => {
  const key = String(text).trim().toLowerCase().slice(0, 3);
  return key.length === 3 ? WEEKDAYS.find((day) => day.toLowerCase().slice(0, 3) === key) : undefined;
};

// Accepts an array, a JSON string, or text such as 'Monday - Wednesday, Friday'.
const parseDays = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return sortDays(value.map(matchWeekday).filter(Boolean));
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parseDays(parsed);
  } catch {
    // plain text, handled below
  }
  const found = new Set();
  value.split(',').forEach((part) => {
    const [from, to] = part.split(/\s+-\s+|–/).map(matchWeekday);
    if (from && to) {
      const a = WEEKDAYS.indexOf(from);
      const b = WEEKDAYS.indexOf(to);
      for (let i = a; i <= b; i += 1) found.add(WEEKDAYS[i]);
    } else if (from) {
      found.add(from);
    }
  });
  return sortDays([...found]);
};

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

// '8:05' -> { hour: 8, minute: 5 } when it is a valid 12-hour clock time, otherwise null.
const parseClock = (text) => {
  const match = TIME_PATTERN.exec(String(text).trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return { hour, minute };
};

const toMinutes = (text, period) => {
  const clock = parseClock(text);
  if (!clock) return null;
  return ((clock.hour % 12) + (period === 'PM' ? 12 : 0)) * 60 + clock.minute;
};

const padClock = (text) => {
  const clock = parseClock(text);
  if (!clock) return text;
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
};

const formatClock = (text, period) => {
  const clock = parseClock(text);
  return clock ? `${clock.hour}:${String(clock.minute).padStart(2, '0')} ${period}` : '';
};

// Backend availability: { availabilityDays: ['Mon', ...] | null, availabilityHours: '9:00 AM - 5:00 PM' | null }
const parseAvailability = (other) => {
  const result = { days: parseDays(other?.availabilityDays), startTime: '', startPeriod: 'AM', endTime: '', endPeriod: 'PM' };
  const match = /(\d{1,2}:\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}:\d{2})\s*(AM|PM)/i.exec(String(other?.availabilityHours || ''));
  if (match) {
    result.startTime = padClock(match[1]);
    result.startPeriod = match[2].toUpperCase();
    result.endTime = padClock(match[3]);
    result.endPeriod = match[4].toUpperCase();
  }
  return result;
};

const buildHours = (startTime, startPeriod, endTime, endPeriod) =>
  parseClock(startTime) && parseClock(endTime)
    ? `${formatClock(startTime, startPeriod)} - ${formatClock(endTime, endPeriod)}`
    : '';

// Types '0830' or '08:30' -> '08:30'.
const formatTimeInput = (raw) => {
  const cleaned = raw.replace(/[^\d:]/g, '');
  if (cleaned.includes(':')) return cleaned.slice(0, 5);
  return cleaned.length > 2 ? `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}` : cleaned;
};

// ── Small UI pieces ───────────────────────────────────────────────────────

const INPUT_CLASS =
  "box-border h-[40px] w-full rounded-[8px] border border-[#818080] bg-white px-[9px] font-['SF_Pro',system-ui,sans-serif] text-[15px] leading-[170%] text-[#6F6F6F] placeholder:text-[#9B9797] focus:border-[#005FCA] focus:outline-none";

const LABEL_CLASS =
  "mb-[2px] block font-['SF_Pro',system-ui,sans-serif] text-[15px] font-normal leading-[170%] text-[#484040]";

function Chevron() {
  return (
    <svg width="17" height="10" viewBox="0 0 17 10" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M1.5 1.5l7 6.5 7-6.5" stroke="#7C7979" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// Select-style dropdown. `multiple` keeps the list open and toggles each option.
function Dropdown({ id, options, value, onChange, placeholder, display, multiple = false, ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const isSelected = (option) => (multiple ? value.includes(option) : value === option);

  const choose = (option) => {
    if (multiple) {
      onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
    } else {
      onChange(option);
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="box-border flex h-[40px] w-full cursor-pointer items-center justify-between rounded-[8px] border border-[#818080] bg-white pl-[9px] pr-[13px] text-left font-['SF_Pro',system-ui,sans-serif] text-[15px] leading-[170%] focus:border-[#005FCA] focus:outline-none"
      >
        <span className={`truncate ${display ? 'text-[#484040]' : 'text-[#6F6F6F]'}`}>{display || placeholder}</span>
        <Chevron />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable={multiple}
          className="absolute left-0 right-0 top-full z-30 m-0 box-border list-none rounded-[8px] border border-[#818080] bg-white px-0 py-[6px] shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
        >
          {options.map((option) => {
            const selected = isSelected(option);
            return (
              <li key={option} role="option" aria-selected={selected} className="m-0 p-0">
                <button
                  type="button"
                  onClick={() => choose(option)}
                  className={`flex h-[32px] w-full cursor-pointer items-center justify-between border-0 bg-transparent px-[11px] text-left font-['SF_Pro',system-ui,sans-serif] text-[15px] leading-[170%] hover:bg-[#EEF4FB] ${
                    selected ? 'font-bold text-[#005FCA]' : 'text-[#484040]'
                  }`}
                >
                  <span>{option}</span>
                  {selected && (
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                      <path d="M1.5 5.5l3.8 3.8L12.5 1.8" stroke="#005FCA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function ServiceProviderEditProfile() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const hasUser = Boolean(user);

  // Loaded from the backend
  const [provider, setProvider] = useState(undefined); // undefined = loading, null = never applied
  const [loadError, setLoadError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Editable fields
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [days, setDays] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [startPeriod, setStartPeriod] = useState('AM');
  const [endTime, setEndTime] = useState('');
  const [endPeriod, setEndPeriod] = useState('PM');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // Photo chosen but not saved yet
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef(null);

  // Values as loaded, to send only what changed
  const initialRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!hasUser) return undefined;
    let cancelled = false;

    api
      .getMyProviderProfile()
      .then((data) => {
        if (cancelled) return;
        const availability = parseAvailability(data?.other);
        const loaded = {
          email: data?.account?.email || '',
          address: data?.account?.address || '',
          companyName: data?.other?.companyName || '',
          companyAddress: data?.other?.companyAddress || '',
          ...availability,
        };
        loaded.hours = buildHours(loaded.startTime, loaded.startPeriod, loaded.endTime, loaded.endPeriod);
        initialRef.current = loaded;

        setDisplayName(data?.fullName || user.name || '');
        setPhotoUrl(data?.photoUrl || user.photoUrl || '');
        setEmail(loaded.email);
        setAddress(loaded.address);
        setCompanyName(loaded.companyName);
        setCompanyAddress(loaded.companyAddress);
        setDays(loaded.days);
        setStartTime(loaded.startTime);
        setStartPeriod(loaded.startPeriod);
        setEndTime(loaded.endTime);
        setEndPeriod(loaded.endPeriod);
        setProvider(data || {});
      })
      .catch((err) => {
        if (cancelled) return;
        // 403 = this account has no service provider application.
        if (err.status === 403) setProvider(null);
        else setLoadError(err.message || "Couldn't load your profile.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUser]);

  // Free the temporary preview URL.
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview]
  );

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (loadError) {
    return <p className="m-0 p-6 font-[Roboto] text-[14px] text-[#B91C1C]">{loadError}</p>;
  }
  if (provider === undefined) return null;
  if (provider === null) return <Navigate to="/role-selection" replace />;

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose an image file for your profile photo.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrorMsg('Your profile photo must be 5 MB or smaller.');
      return;
    }
    setErrorMsg('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return 'Enter a valid email address.';
    if (!address.trim()) return 'Address is required.';

    if (startTime.trim() || endTime.trim()) {
      if (!parseClock(startTime)) return 'Enter a start time between 1:00 and 12:59, for example 08:00.';
      if (!parseClock(endTime)) return 'Enter an end time between 1:00 and 12:59, for example 05:00.';
      if (toMinutes(endTime, endPeriod) <= toMinutes(startTime, startPeriod)) {
        return 'Your end time must be later than your start time.';
      }
    }
    return '';
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setErrorMsg(problem);
      return;
    }

    const initial = initialRef.current || {};
    const hours = buildHours(startTime, startPeriod, endTime, endPeriod);
    const sortedDays = sortDays(days);

    // Send only the fields that changed (PATCH /api/providers/me/profile).
    const changes = {};
    if (email.trim() !== (initial.email || '')) changes.email = email.trim();
    if (address.trim() !== (initial.address || '')) changes.address = address.trim();
    if (companyName.trim() !== (initial.companyName || '')) changes.companyName = companyName.trim();
    if (companyAddress.trim() !== (initial.companyAddress || '')) changes.companyAddress = companyAddress.trim();
    if (JSON.stringify(sortedDays) !== JSON.stringify(initial.days || [])) {
      changes.availabilityDays = sortedDays.map(toBackendDay);
    }
    if (hours !== (initial.hours || '')) changes.availabilityHours = hours || null;

    if (Object.keys(changes).length === 0 && !photoFile) {
      navigate('/serviceprovider/profile');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let savedPhotoUrl = null;
      if (photoFile) {
        const uploaded = await api.uploadProviderPhoto(photoFile);
        savedPhotoUrl = uploaded?.photoUrl || null;
      }

      let saved = null;
      if (Object.keys(changes).length > 0) {
        saved = await api.updateMyProviderProfile(changes);
      }

      if (setUser) {
        setUser((prev) => ({
          ...prev,
          ...(saved?.account?.email ? { email: saved.account.email } : {}),
          ...(saved?.account?.address ? { address: saved.account.address } : {}),
          ...(savedPhotoUrl ? { photoUrl: savedPhotoUrl } : {}),
        }));
      }

      navigate('/serviceprovider/profile');
    } catch (err) {
      console.error('Error saving provider profile changes:', err);
      // The backend returns per-field messages (e.g. { email: 'Enter a valid email address' }).
      const fieldMessage = err.details && typeof err.details === 'object' ? Object.values(err.details)[0] : '';
      setErrorMsg(fieldMessage || err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysLabel = formatDayRanges(days);

  return (
    <ServiceProviderSidebar>
      <div className="box-border min-w-[820px] px-4 pb-[40px] pt-6 sm:pl-[31px] sm:pr-[66px]">
        {/* Page title */}
        <h1 className="m-0 flex min-h-[68px] items-center pl-[23px] font-['Quicksand'] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px] lg:leading-[32px]">
          Profile
        </h1>

        {/* Banner, avatar and name */}
        <div className="relative mt-[17px]">
          <div className="box-border h-[142px] rounded-b-[1px] rounded-t-[10px] border border-b-0 border-black/[0.14] bg-[#7DABDD]" />
          <div className="relative box-border h-[82px] rounded-b-[10px] border border-t-0 border-black/40 bg-[#FDFFFF]">
            <p className="absolute left-[189px] top-[18px] m-0 max-w-[calc(100%-220px)] truncate font-['Quicksand'] text-[24px] font-bold leading-[30px] text-[#292727]">
              {displayName}
            </p>
          </div>

          <div className="absolute left-[27px] top-[82px] h-[121px] w-[121px]">
            <UserAvatar
              name={displayName}
              src={photoPreview || photoUrl}
              sizeClass="h-[121px] w-[121px]"
              textClass="text-[64px] leading-[77px]"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute bottom-0 right-[5px] flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[6px] border-0 bg-white/90 p-0"
            >
              <PencilIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </div>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
          className="pl-[3px]"
        >
          {/* Account Details */}
          <h2 className="m-0 mt-[33px] font-['Quicksand'] text-[18px] font-bold leading-[22px] text-[#292727]">
            Account Details
          </h2>

          {errorMsg && (
            <div role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          <div className="mt-[8px]">
            <div className="mb-[5px]">
              <label htmlFor="sp-email" className={LABEL_CLASS}>
                Email Address
              </label>
              <input
                id="sp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className={INPUT_CLASS}
              />
            </div>

            <div className="mb-[5px]">
              <label htmlFor="sp-address" className={LABEL_CLASS}>
                Address
              </label>
              <input
                id="sp-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                autoComplete="street-address"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {/* Other Details */}
          <h2 className="m-0 mt-[25px] font-['Quicksand'] text-[18px] font-bold leading-[22px] text-[#292727]">
            Other Details
          </h2>

          <div className="mt-[6px]">
            <label htmlFor="sp-days" className={LABEL_CLASS}>
              Availability
            </label>
            <div className="flex items-start gap-[11px]">
              <Dropdown
                id="sp-days"
                multiple
                options={WEEKDAYS}
                value={days}
                onChange={(next) => setDays(sortDays(next))}
                placeholder="Select Days"
                display={daysLabel}
                ariaLabel="Available days"
                className="min-w-0 flex-[450_1_0%]"
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={startTime}
                onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
                placeholder="00:00"
                aria-label="Start time"
                className={`${INPUT_CLASS} min-w-0 flex-[230_1_0%]`}
              />
              <Dropdown
                options={PERIODS}
                value={startPeriod}
                onChange={setStartPeriod}
                display={startPeriod}
                ariaLabel="Start time AM or PM"
                className="w-[60px] shrink-0"
              />
              <span aria-hidden="true" className="mt-[19px] h-px w-[8px] shrink-0 bg-[#818080]" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={endTime}
                onChange={(e) => setEndTime(formatTimeInput(e.target.value))}
                placeholder="00:00"
                aria-label="End time"
                className={`${INPUT_CLASS} min-w-0 flex-[230_1_0%]`}
              />
              <Dropdown
                options={PERIODS}
                value={endPeriod}
                onChange={setEndPeriod}
                display={endPeriod}
                ariaLabel="End time AM or PM"
                className="w-[60px] shrink-0"
              />
            </div>
          </div>

          <div className="mb-[5px] mt-[17px]">
            <label htmlFor="sp-company-name" className={LABEL_CLASS}>
              Company Name
            </label>
            <input
              id="sp-company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              autoComplete="organization"
              className={INPUT_CLASS}
            />
          </div>

          <div className="mb-[5px]">
            <label htmlFor="sp-company-address" className={LABEL_CLASS}>
              Company Address
            </label>
            <input
              id="sp-company-address"
              type="text"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Company address"
              className={INPUT_CLASS}
            />
          </div>

          {/* Save */}
          <div className="mt-[20px] flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="box-border h-[50px] w-[265px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[linear-gradient(270deg,#04A5A5_0%,#0255AF_100%)] font-['SF_Pro',system-ui,sans-serif] text-[15px] font-bold leading-[170%] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </ServiceProviderSidebar>
  );
}