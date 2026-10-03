import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import { me } from '../api/client';
import { useAuth } from '../context/auth_context';

// Shown under the welcome heading, based on the provider application's status in the backend.
const STATUS_LABELS = {
  pending: 'Application under review',
  verified: 'Verified Service Provider',
  rejected: 'Application not approved',
};

// "Mark Frederick Cerillo" -> "MC"
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const SECTION_LABEL =
  'm-0 mb-3 mt-5 font-[Lato] text-[16px] font-bold uppercase leading-[19px] text-black/50';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEAR_RANGE = 6; // years shown before/after the current year in the year dropdown

// The provider's working hours. Structurally this is schedule configuration rather than
// per-user data, so it's kept as a constant like the nav items above — but it could be
// swapped for a backend-fetched list (e.g. GET /api/provider/working-hours) if a provider's
// hours become customizable later.
const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Builds a 6-row Sun–Sat grid for the given month, including the trailing/leading days
// from the adjacent months (shown muted, matching the Figma calendar).
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

function StatCard({ value, label }) {
  return (
    <div className="box-border flex flex-1 flex-col items-center justify-center rounded-[10px] bg-[#E7E7E7] px-6 py-5 text-center">
      <p className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[28px] font-bold leading-[1.2] text-black sm:text-[32px]">
        {value}
      </p>
      <p className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[14px] text-black sm:text-[15px]">{label}</p>
    </div>
  );
}

function EmptyBox({ sizeClass, message, children }) {
  return (
    <div
      className={`box-border flex w-full flex-col rounded-lg border-[0.5px] border-[#1F1D1D]/45 ${sizeClass} ${
        children ? 'justify-start overflow-y-auto p-4' : 'items-center justify-center'
      }`}
    >
      {children || (
        <p className="m-0 text-center font-[Roboto] text-[14px] font-medium leading-[23px] text-[#817C7C]">
          {message}
        </p>
      )}
    </div>
  );
}

// Calendar / availability modal opened from "Manage your Calendar". A provider picks a date,
// then a time slot on that date, and can mark that slot unavailable (or, with no slot picked,
// mark the whole day unavailable). All slot statuses come from the backend per date — nothing
// about a provider's actual availability is hard-coded here.
function CalendarModal({ onClose }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // TODO: replace with the provider's saved availability fetched from the backend
  // (e.g. GET /api/provider/availability?month=YYYY-MM), keyed by date, then by time slot:
  // { '2026-09-09': { '10:00 AM': 'unavailable' } }. Any date/slot missing from this map
  // is treated as available. Re-fetch whenever the visible month changes.
  const [availability, setAvailability] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // TODO: fetch availability for { viewYear, viewMonth }, then call setAvailability({...})
  }, [viewYear, viewMonth]);

  const selectedDateKey = toDateKey(selectedDate);
  const dayAvailability = availability[selectedDateKey] || {};

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goToMonth = (offset) => {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date.getMonth() !== viewMonth || date.getFullYear() !== viewYear) {
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
  };

  const handleMarkUnavailable = async () => {
    if (!selectedSlot) return;
    setIsSaving(true);
    try {
      // TODO: call the backend to persist this, e.g.
      // await api.setAvailability({ date: selectedDateKey, slot: selectedSlot, status: 'unavailable' });
      setAvailability((prev) => ({
        ...prev,
        [selectedDateKey]: { ...prev[selectedDateKey], [selectedSlot]: 'unavailable' },
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const yearOptions = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => today.getFullYear() - YEAR_RANGE + i);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
      onClick={onClose}
    >
      <div
        className="relative box-border w-full max-w-[340px] rounded-2xl bg-white p-6 font-[Roboto]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex cursor-pointer border-none bg-transparent p-0"
        >
          <X size={18} color="#000000" />
        </button>

        <p className="m-0 mb-2 font-[Quicksand] text-[13px] font-bold text-black">Select Date</p>

        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="flex cursor-pointer border-none bg-transparent p-1"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="rounded-md border border-[#DAD2D2] px-2 py-1 text-[13px] font-semibold text-black"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="rounded-md border border-[#DAD2D2] px-2 py-1 text-[13px] font-semibold text-black"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="flex cursor-pointer border-none bg-transparent p-1"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="text-[11px] font-semibold text-black/40">{w}</span>
          ))}

          {grid.map(({ date, inMonth }) => {
            const key = toDateKey(date);
            const isSelected = key === selectedDateKey;
            const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <button
                key={key}
                type="button"
                disabled={isPast}
                onClick={() => handleSelectDate(date)}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${
                  isSelected
                    ? 'bg-black font-bold text-white'
                    : inMonth
                    ? isPast
                      ? 'cursor-not-allowed text-black/25'
                      : 'cursor-pointer text-black hover:bg-black/5'
                    : 'cursor-default text-black/25'
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <p className="m-0 mb-2 mt-5 font-[Quicksand] text-[13px] font-bold text-black">Select Time</p>

        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.length === 0 && (
            <p className="col-span-2 m-0 text-[12px] text-[#817C7C]">No time slots configured</p>
          )}
          {TIME_SLOTS.map((slot) => {
            const status = dayAvailability[slot]; // undefined = available, 'unavailable' = blocked
            const isUnavailable = status === 'unavailable';
            const isSelected = slot === selectedSlot;

            return (
              <button
                key={slot}
                type="button"
                disabled={isUnavailable}
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
                  isUnavailable
                    ? 'cursor-not-allowed border-[#DAD2D2] bg-[#F2F2F2] text-black/30 line-through'
                    : isSelected
                    ? 'cursor-pointer border-black bg-black text-white'
                    : 'cursor-pointer border-[#DAD2D2] bg-white text-black hover:border-black/40'
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleMarkUnavailable}
            disabled={!selectedSlot || isSaving}
            className={`rounded-md border border-[#DAD2D2] bg-white px-4 py-2 text-[12px] font-semibold text-black ${
              !selectedSlot || isSaving ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-black/5'
            }`}
          >
            {isSaving ? 'Saving…' : 'Mark as Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceProviderDashboard() {
  const { user, loading } = useAuth();
  const [provider, setProvider] = useState(undefined); // undefined = still loading, null = never applied
  const [loadError, setLoadError] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // TODO: fill these from the backend once the endpoints exist.
  const [stats, setStats] = useState(null); // { activeJobs, thisMonth, rating }
  const [pendingRequests, setPendingRequests] = useState([]); // [{ id, title }]
  const [notifications, setNotifications] = useState([]); // [{ id, message }]
  const [activeRepairs, setActiveRepairs] = useState([]); // [{ id, title, status, customer }]

  // Load this account's provider application from the backend.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    me()
      .then((data) => {
        if (!cancelled) setProvider(data.provider || null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Couldn't load your account.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (loadError) {
    return <p className="m-0 p-6 font-[Roboto] text-[14px] text-[#B91C1C]">{loadError}</p>;
  }
  if (provider === undefined) return null;
  // No provider application on this account: send them to choose a role / apply.
  if (provider === null) return <Navigate to="/role-selection" replace />;

  const firstName = user.name?.trim().split(/\s+/)[0] || '';
  const initials = getInitials(user.name);
  const role = STATUS_LABELS[provider.verification_status] || 'Service Provider';
  const activeJobs = stats?.activeJobs ?? 0;
  const thisMonth = stats?.thisMonth ?? 0;
  const rating = stats?.rating ?? 0;

  return (
    <ServiceProviderSidebar initials={initials}>
      {/* Same padding as the admin/customer dashboard (24px / 36px), fluid width */}
      <div className="box-border px-4 py-6 sm:px-9">
        <h1 className="m-0 mb-1 font-[Quicksand] text-[32px] font-bold leading-none text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Welcome, {firstName}!
        </h1>
        <p className="m-0 mb-5 font-[Quicksand] text-[18px] font-bold text-black/70 sm:text-[20px]">
          {role}
        </p>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row">
          <StatCard value={activeJobs} label="Active jobs" />
          <StatCard value={thisMonth} label="This month" />
          <StatCard value={rating} label="Rating" />
        </div>

        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
          className="box-border flex h-[46px] w-full cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white"
        >
          Manage your Calendar
        </button>

        <div className="mt-5 flex flex-col gap-x-8 gap-y-5 sm:flex-row">
          <div className="flex-1">
            <h2 className={SECTION_LABEL}>Pending Request</h2>
            <EmptyBox sizeClass="min-h-[110px] sm:h-[132px]" message="None">
              {pendingRequests.length > 0 &&
                pendingRequests.map((r) => (
                  <p
                    key={r.id}
                    className="m-0 border-b border-black/10 py-2 font-[Roboto] text-[14px] text-[#292727] last:border-b-0"
                  >
                    {r.title}
                  </p>
                ))}
            </EmptyBox>
          </div>

          <div className="flex-1">
            <h2 className={SECTION_LABEL}>Notifications</h2>
            <EmptyBox sizeClass="min-h-[110px] sm:h-[132px]" message="No Notifications">
              {notifications.length > 0 &&
                notifications.map((n) => (
                  <p
                    key={n.id}
                    className="m-0 border-b border-black/10 py-2 font-[Roboto] text-[14px] text-[#292727] last:border-b-0"
                  >
                    {n.message}
                  </p>
                ))}
            </EmptyBox>
          </div>
        </div>

        <h2 className={SECTION_LABEL}>Active Repair</h2>
        <EmptyBox sizeClass="min-h-[160px] sm:h-[212px]" message="No Active Repair">
          {activeRepairs.length > 0 &&
            activeRepairs.map((r) => (
              <div key={r.id} className="border-b border-black/10 py-3 last:border-b-0">
                <p className="m-0 font-[Quicksand] text-[16px] font-bold text-black">{r.title}</p>
                <p className="m-0 font-[Roboto] text-[14px] text-[#817C7C]">
                  {[r.customer, r.status].filter(Boolean).join(' - ')}
                </p>
              </div>
            ))}
        </EmptyBox>
      </div>

      {isCalendarOpen && <CalendarModal onClose={() => setIsCalendarOpen(false)} />}
    </ServiceProviderSidebar>
  );
}