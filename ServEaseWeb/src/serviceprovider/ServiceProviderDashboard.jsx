import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import ServiceProviderSidebar from '../components/ServiceProviderSidebar.jsx';
import {
  FALLBACK_APPOINTMENT_HOURS,
  buildSlots,
  isPastSlotToday,
  parseAppointmentHours,
} from '../../utils/appointmentSlots';
import {
  getProviderAvailability,
  getProviderDashboard,
  me,
  setProviderAvailability,
} from '../api/client';
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

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEAR_RANGE = 6; // years shown before/after the current year in the year dropdown

// The provider's calendar offers the same time slots as the customer's appointment picker: 9:00 AM to
// 4:00 PM, one slot per hour (see utils/appointmentSlots.js). The backend can set the hours through
// `appointmentHours` in GET /api/provider/dashboard.

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

// "Roof Leakage | #SR-0000"
const rowTitle = (category, requestId) => {
  const ref = requestId ? `#${String(requestId).replace(/^#/, '')}` : '';
  return [category, ref].filter(Boolean).join(' | ');
};

// 8150 -> "₱8,150"
const formatPeso = (amount) => `₱${Number(amount || 0).toLocaleString('en-PH')}`;

// White card with a bold title (Figma: Pending Request / Active Repair / Earnings).
function DashboardCard({ title, minHeightClass, actionLabel, actionTo, children }) {
  return (
    <section
      className={`box-border flex w-full flex-col rounded-[14px] border border-[#C9C2C2] bg-white px-[21px] pb-[21px] pt-[11px] ${minHeightClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[15px] font-bold leading-[26px] text-[#414141]">
          {title}
        </h2>
        {actionTo && (
          <Link
            to={actionTo}
            className="font-[SF_Pro,system-ui,sans-serif] text-[13px] font-medium leading-[26px] text-[#005FCA] no-underline hover:underline"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Card body for a list of requests; shows a centered message when the list is empty.
function RequestList({ items, emptyMessage }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="m-0 text-center font-[Roboto] text-[14px] font-medium leading-[23px] text-[#817C7C]">
          {emptyMessage}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-[6px] flex flex-col gap-[12px]">
      {items.map((r) => (
        <div
          key={r.id}
          className="box-border flex h-[54px] w-full flex-none flex-col overflow-hidden rounded-[14px] border border-[#C9C2C2] bg-white px-[15px] pt-[8px]"
        >
          <p className="m-0 truncate font-[SF_Pro,system-ui,sans-serif] text-[12px] font-bold leading-[20px] text-[#3D3D3D]">
            {r.title}
          </p>
          <p className="m-0 truncate font-[SF_Pro,system-ui,sans-serif] text-[11px] font-normal leading-[19px] text-[#484040]">
            {r.summary}
          </p>
        </div>
      ))}
    </div>
  );
}

// One amount + caption in the Earnings card (e.g. "₱8,150" / "This week").
function EarningsFigure({ amount, label }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[20px] font-bold leading-[34px] text-[#3D3D3D]">
        {formatPeso(amount)}
      </p>
      <p className="m-0 font-[SF_Pro,system-ui,sans-serif] text-[11px] font-normal leading-[19px] text-[#484040]">
        {label}
      </p>
    </div>
  );
}

// Calendar / availability modal opened from "Manage your Calendar" (Figma: Manage Calendar).
// The provider picks a date, optionally one or more time slots on it, and presses
//   - "Mark as Available"   (green) or
//   - "Mark as Unavailable" (red).
// With no time picked the action applies to the whole day. Customers only see (and can only book)
// providers who are available on the day and time of their request, so this is what feeds that check.
// Saved slot by slot with PUT /api/providers/availability { date, slot, status: 'available' | 'unavailable' };
// every slot status comes from the backend per date — nothing about availability is hard-coded here.
function CalendarModal({ hours, onClose }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlots, setSelectedSlots] = useState(() => new Set()); // empty = the whole day

  // 09:00 AM ... 04:00 PM, one per hour.
  const timeSlots = useMemo(
    () => buildSlots(hours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours.startMinutes, hours.endMinutes, hours.stepMinutes]
  );

  // The provider's saved availability from the backend (GET /api/providers/availability), keyed
  // by date, then by time slot: { '2026-09-09': { '10:00 AM': 'unavailable' } }. Any date/slot
  // missing from this map is treated as available. Re-fetched whenever the visible month changes.
  const [availability, setAvailability] = useState({});
  const [savingStatus, setSavingStatus] = useState(null); // 'available' | 'unavailable' while saving
  const [calendarError, setCalendarError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    const from = toDateKey(new Date(viewYear, viewMonth, 1));
    const to = toDateKey(new Date(viewYear, viewMonth + 1, 0));
    getProviderAvailability({ from, to })
      .then((saved) => {
        if (cancelled) return;
        setCalendarError('');
        setAvailability((prev) => ({ ...prev, ...saved }));
      })
      .catch((err) => {
        if (!cancelled) setCalendarError(err.message || "Couldn't load your availability.");
      });
    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  const selectedDateKey = toDateKey(selectedDate);
  const isToday = selectedDateKey === toDateKey(new Date());
  const dayAvailability = availability[selectedDateKey] || {};
  const isBlocked = (slot) => dayAvailability[slot] === 'unavailable';

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Slots of today that already started can't be changed any more.
  const isSlotPast = (slot) => isPastSlotToday(slot, isToday);
  const changeableSlots = timeSlots.map((s) => s.time).filter((slot) => !isSlotPast(slot));

  // What the buttons act on: the picked slots, or every slot of the day when none is picked.
  const targetSlots =
    selectedSlots.size > 0 ? changeableSlots.filter((slot) => selectedSlots.has(slot)) : changeableSlots;
  const canMarkAvailable = targetSlots.some((slot) => isBlocked(slot));
  const canMarkUnavailable = targetSlots.some((slot) => !isBlocked(slot));

  const goToMonth = (offset) => {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setSelectedSlots(new Set());
    setNotice('');
    setCalendarError('');
    if (date.getMonth() !== viewMonth || date.getFullYear() !== viewYear) {
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
  };

  const toggleSlot = (slot) => {
    setNotice('');
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  // Saves the new status for the target slots (only the ones that actually change).
  const applyStatus = async (status) => {
    const slots = targetSlots.filter((slot) => isBlocked(slot) !== (status === 'unavailable'));
    if (slots.length === 0 || savingStatus) return;

    const dateKey = selectedDateKey;
    setSavingStatus(status);
    setCalendarError('');
    setNotice('');

    // Saved on the backend first; the profile page and the customers' provider search read the same data.
    const results = await Promise.allSettled(
      slots.map((slot) => setProviderAvailability({ date: dateKey, slot, status }))
    );
    const saved = slots.filter((_, i) => results[i].status === 'fulfilled');

    if (saved.length > 0) {
      setAvailability((prev) => {
        const day = { ...(prev[dateKey] || {}) };
        saved.forEach((slot) => {
          if (status === 'unavailable') day[slot] = 'unavailable';
          else delete day[slot];
        });
        return { ...prev, [dateKey]: day };
      });
    }

    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      setCalendarError(failed.reason?.message || "Couldn't save your availability. Please try again.");
    } else {
      const dayLabel = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const what = saved.length === timeSlots.length ? 'The whole day' : `${saved.length} time slot${saved.length > 1 ? 's' : ''}`;
      setNotice(`${what} on ${dayLabel} marked as ${status}.`);
      setSelectedSlots(new Set());
    }
    setSavingStatus(null);
  };

  const yearOptions = Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => today.getFullYear() - YEAR_RANGE + i);

  const hint =
    selectedSlots.size > 0
      ? `${selectedSlots.size} time${selectedSlots.size > 1 ? 's' : ''} selected`
      : 'No time selected — the buttons apply to the whole day';

  const actionButton =
    'box-border h-[35px] w-[140px] cursor-pointer rounded-[10px] border border-[#B1A8A8] font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] text-white disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5"
      onClick={onClose}
    >
      <div
        className="relative box-border max-h-full w-full max-w-[434px] overflow-y-auto rounded-[10px] bg-white px-[21px] pb-6 pt-[22px] font-[Roboto]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex cursor-pointer border-none bg-transparent p-0"
        >
          <X size={17} color="#000000" />
        </button>

        <p className="m-0 mb-2 font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] text-[#191818]">
          Select Date
        </p>

        <div className="box-border rounded-2xl bg-[#DDDDDD] p-4">
          <div className="mb-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
              className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0"
            >
              <ChevronLeft size={20} color="#1E1E1E" />
            </button>

            <div className="flex min-w-0 flex-1 gap-2">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Month"
                className="box-border h-7 min-w-0 flex-1 rounded-lg border-none bg-white px-[6px] font-[Inter] text-[10px] text-[#1E1E1E]"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Year"
                className="box-border h-7 min-w-0 flex-1 rounded-lg border border-[#D9D9D9] bg-white px-[6px] font-[Inter] text-[10px] text-[#1E1E1E]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Next month"
              className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0"
            >
              <ChevronRight size={20} color="#1E1E1E" />
            </button>
          </div>

          <div className="mx-auto grid w-full max-w-[286px] grid-cols-7 gap-px">
            {WEEKDAY_LABELS.map((w) => (
              <span
                key={w}
                className="flex h-5 items-center justify-center font-[Geist,Inter,sans-serif] text-[12px] leading-5 text-[#757575]"
              >
                {w}
              </span>
            ))}

            {grid.map(({ date, inMonth }) => {
              const key = toDateKey(date);
              const isSelected = key === selectedDateKey;
              const isPast = date < startOfToday;
              // A small red dot marks days where something is already marked unavailable.
              const hasBlocked = Object.values(availability[key] || {}).includes('unavailable');

              return (
                <button
                  key={key}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDate(date)}
                  className={`relative flex h-10 w-full items-center justify-center rounded-lg border-none p-0 font-[Inter] text-[10px] leading-[14px] ${
                    isSelected
                      ? 'cursor-pointer bg-[#2C2C2C] text-[#F5F5F5]'
                      : !inMonth
                      ? 'cursor-default bg-transparent text-[#B3B3B3]'
                      : isPast
                      ? 'cursor-not-allowed bg-transparent text-[#B3B3B3]'
                      : 'cursor-pointer bg-transparent text-[#1E1E1E] hover:bg-black/10'
                  }`}
                >
                  {date.getDate()}
                  {hasBlocked && inMonth && (
                    <span className="absolute bottom-[5px] h-[4px] w-[4px] rounded-full bg-[#C62828]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="m-0 mb-2 mt-4 font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] text-[#191818]">
          Select Time
        </p>

        <div className="grid grid-cols-4 gap-2">
          {timeSlots.length === 0 && (
            <p className="col-span-4 m-0 text-[12px] text-[#817C7C]">No time slots configured</p>
          )}
          {timeSlots.map(({ time: slot }) => {
            const blocked = isBlocked(slot);
            const past = isSlotPast(slot);
            const chosen = selectedSlots.has(slot);

            return (
              <button
                key={slot}
                type="button"
                disabled={past}
                aria-pressed={chosen}
                title={past ? 'This time has already passed' : blocked ? 'Marked unavailable' : undefined}
                onClick={() => toggleSlot(slot)}
                className={`box-border h-[33px] rounded-[10px] border px-1 font-[SF_Pro,system-ui,sans-serif] text-[10px] font-bold leading-[17px] ${
                  past
                    ? 'cursor-not-allowed border-[#E5E0E0] bg-[#F5F3F3] text-black/30'
                    : chosen
                    ? 'cursor-pointer border-[#B1A8A8] bg-[#2C2C2C] text-white'
                    : blocked
                    ? 'cursor-pointer border-[#E7B4B4] bg-[#FDECEC] text-[#C62828] line-through'
                    : 'cursor-pointer border-[#B1A8A8] bg-[#FFFDFD] text-[#414141] hover:border-black/40'
                }`}
              >
                {slot}
              </button>
            );
          })}
        </div>

        <p className="m-0 mt-2 text-center font-[SF_Pro,system-ui,sans-serif] text-[10px] leading-[14px] text-[#817C7C]">
          {hint}. Crossed-out red times are already unavailable.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-[52px] gap-y-3">
          <button
            type="button"
            onClick={() => applyStatus('available')}
            disabled={!canMarkAvailable || savingStatus !== null}
            className={`${actionButton} bg-[#2E7D32]`}
          >
            {savingStatus === 'available' ? 'Saving…' : 'Mark as Available'}
          </button>
          <button
            type="button"
            onClick={() => applyStatus('unavailable')}
            disabled={!canMarkUnavailable || savingStatus !== null}
            className={`${actionButton} bg-[#C62828]`}
          >
            {savingStatus === 'unavailable' ? 'Saving…' : 'Mark as Unavailable'}
          </button>
        </div>

        {notice && (
          <p role="status" className="m-0 mt-3 text-center text-[12px] text-[#2E7D32]">
            {notice}
          </p>
        )}
        {calendarError && (
          <p role="alert" className="m-0 mt-3 text-center text-[12px] text-[#B91C1C]">
            {calendarError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ServiceProviderDashboard() {
  const { user, loading } = useAuth();
  const [provider, setProvider] = useState(undefined); // undefined = still loading, null = never applied
  const [loadError, setLoadError] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [appointmentHours, setAppointmentHours] = useState(FALLBACK_APPOINTMENT_HOURS);

  // GET /api/provider/dashboard — stat cards, pending requests, active repair, earnings.
  const [stats, setStats] = useState(null); // { activeJobs, thisMonth, rating }
  const [pendingRequests, setPendingRequests] = useState([]); // [{ id, title, summary }]
  const [activeRepairs, setActiveRepairs] = useState([]); // [{ id, title, summary }]
  const [earnings, setEarnings] = useState({ thisWeek: 0, pendingPayment: 0 });

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getProviderDashboard()
      .then((data) => {
        if (cancelled) return;
        setAppointmentHours(parseAppointmentHours(data?.appointmentHours));
        setStats({
          activeJobs: data?.stats?.activeJobs ?? 0,
          thisMonth: data?.stats?.jobsThisMonth ?? 0,
          rating: data?.stats?.rating ?? 0,
        });
        setPendingRequests(
          (data?.pendingRequests ?? []).map((r) => ({
            id: r.id,
            title: rowTitle(r.category, r.requestNumber),
            summary: r.description || r.customerName || '',
          }))
        );
        const a = data?.activeRepair;
        setActiveRepairs(
          a
            ? [
                {
                  id: a.requestId,
                  title: rowTitle(a.category, a.requestNumber ?? a.requestId),
                  summary: a.description || [a.customerName, a.statusLabel].filter(Boolean).join(' - '),
                },
              ]
            : []
        );
        // TODO (BACKEND): match these field names to what GET /api/provider/dashboard sends.
        setEarnings({
          thisWeek: data?.earnings?.thisWeek ?? 0,
          pendingPayment: data?.earnings?.pendingPayment ?? 0,
        });
      })
      .catch((err) => console.error('Failed to load the provider dashboard', err));
    return () => {
      cancelled = true;
    };
  }, [user]);

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

        {/* Figma: Pending Request + Active Repair side by side, then the Earnings card */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:mt-[52px] md:grid-cols-2 md:gap-[48px]">
          <DashboardCard title="Pending Request" minHeightClass="min-h-[185px]">
            <RequestList items={pendingRequests} emptyMessage="No Pending Request" />
          </DashboardCard>

          <DashboardCard title="Active Repair" minHeightClass="min-h-[185px]">
            <RequestList items={activeRepairs} emptyMessage="No Active Repair" />
          </DashboardCard>
        </div>

        <div className="mt-6 md:mt-[45px]">
          <DashboardCard
            title="Earnings"
            minHeightClass="min-h-[143px]"
            actionLabel="View"
            actionTo="/serviceprovider/earnings"
          >
            <div className="mt-[3px] grid grid-cols-1 gap-4 sm:grid-cols-2 sm:px-[10%]">
              <EarningsFigure amount={earnings.thisWeek} label="This week" />
              <EarningsFigure amount={earnings.pendingPayment} label="Pending Payment" />
            </div>
          </DashboardCard>
        </div>
      </div>

      {isCalendarOpen && <CalendarModal hours={appointmentHours} onClose={() => setIsCalendarOpen(false)} />}
    </ServiceProviderSidebar>
  );
}