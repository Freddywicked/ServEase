import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, MapPin } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import { createServiceRequest, setDraftRequestId } from '../api/client';
import calendarIcon from '../assets/icon_calendar.png';
import photoIcon from '../assets/icon_photo.png';

// The category chips a customer can pick from. Layout/config, not user data — like the
// nav items in CustomerSidebar — so it stays a constant. Swap for a backend-fetched list
// (e.g. GET /api/categories) if categories become admin-configurable.
const CATEGORIES = ['Home Repair', 'Automotive', 'IT-Related Devices', 'Phone Device'];

// Appointment time options offered at this step, before a provider has been matched.
// TODO: once providers can set their own working hours, this could instead come from
// GET /api/service-request/preferred-slots (or similar) rather than being a fixed list.
const TIME_SLOTS = ['10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM'];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

function formatAppointment(date, time) {
  if (!date || !time) return null;
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${label}, ${time}`;
}

// Step progress bar shared visual for the multi-step "Creating Service Request" flow.
// `activeStep` is 1-indexed; this screen is step 1 of 4.
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

// Appointment date/time picker modal. Selecting a date and a time and pressing Confirm
// hands the chosen appointment back to the parent form.
function AppointmentModal({ initialDate, onClose, onConfirm }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = initialDate || today;

  const [viewYear, setViewYear] = useState(start.getFullYear());
  const [viewMonth, setViewMonth] = useState(start.getMonth());
  const [selectedDate, setSelectedDate] = useState(start);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const grid = buildMonthGrid(viewYear, viewMonth);
  const selectedKey = toDateKey(selectedDate);

  const goToMonth = (offset) => {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    if (date.getMonth() !== viewMonth || date.getFullYear() !== viewYear) {
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5" onClick={onClose}>
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

        <div className="mb-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="flex cursor-pointer border-none bg-transparent p-1"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-[13px] font-semibold text-black">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
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
            const isSelected = key === selectedKey;
            const isPast = date < today;
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
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
                slot === selectedSlot
                  ? 'cursor-pointer border-black bg-black text-white'
                  : 'cursor-pointer border-[#DAD2D2] bg-white text-black hover:border-black/40'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={!selectedSlot}
            onClick={() => onConfirm(selectedDate, selectedSlot)}
            className={`rounded-md px-5 py-2 text-[12px] font-semibold text-white ${
              selectedSlot
                ? 'cursor-pointer bg-gradient-to-r from-[#0255AF] to-[#04A5A5]'
                : 'cursor-not-allowed bg-black/20'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Shows the device's location on a stylized placeholder map. The actual pin position and
// address should be resolved on the backend once the coordinates are sent up.
function LocationField({ coords, status }) {
  return (
    <div className="relative box-border flex h-[140px] w-full items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-[#DCE7F5] to-[#EDF2F8]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(#C7D6E8 1px, transparent 1px), linear-gradient(90deg, #C7D6E8 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative flex flex-col items-center gap-1">
        <MapPin size={30} color="#D9483C" fill="#D9483C" />
        <span className="rounded-md bg-white/90 px-2 py-1 font-[Roboto] text-[12px] text-[#414141]">
          {status === 'ready' && coords
            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : status === 'denied'
            ? 'Location access denied — enter your address manually'
            : 'Detecting your location…'}
        </span>
      </div>
    </div>
  );
}

export default function CreateServiceRequest() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null); // File object, TODO uploaded to backend on submit
  const [appointment, setAppointment] = useState(null); // { date: Date, time: string }
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Device geolocation. The coordinates are sent with the request when the customer presses Next.
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading'); // 'loading' | 'ready' | 'denied' | 'unsupported'

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus('ready');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const appointmentLabel = formatAppointment(appointment?.date, appointment?.time);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPhoto(file);
  };

  const handleConfirmAppointment = (date, time) => {
    setAppointment({ date, time });
    setIsCalendarOpen(false);
  };

  // Creates the draft request on the backend (POST /api/service-requests), remembers its id for the
  // next steps of the flow (AI diagnosis -> choose provider -> submit), then continues.
  const handleNext = async () => {
    if (!category) {
      setError('Please pick a category.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the problem.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description.trim());
      if (photo) formData.append('photo', photo);
      if (appointment) {
        formData.append('appointmentDate', toDateKey(appointment.date)); // "YYYY-MM-DD"
        formData.append('appointmentTime', appointment.time);
      }
      if (coords) {
        formData.append('latitude', coords.lat);
        formData.append('longitude', coords.lng);
      }

      const { request } = await createServiceRequest(formData);
      setDraftRequestId(request.id); // e.g. "SR-0007"
      navigate('/customer/requests/new/diagnosis');
    } catch (err) {
      setError(err.message || "Couldn't save your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-4 py-6 sm:px-9">
        <StepProgress activeStep={1} />

        <h1 className="m-0 mb-4 font-[Quicksand] text-[32px] font-bold text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Creating Service Request
        </h1>

        <h2 className="m-0 mb-1 font-[Roboto] text-[18px] font-semibold text-[#292727] sm:text-[20px]">
          What needs fixing?
        </h2>
        <p className="m-0 mb-4 font-[Roboto] text-[15px] text-[#414141] sm:text-[16px]">
          Pick a category and tell us what&apos;s going on — the more detail, the better the diagnosis.
        </p>

        <h3 className="m-0 mb-2 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
          Category
        </h3>
        <div className="mb-5 flex flex-wrap gap-3">
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-[10px] border px-5 py-3 font-[Roboto] text-[13px] sm:text-[14px] ${
                  active
                    ? 'border-[#818080] bg-gradient-to-r from-[#0255AF] to-[#04A5A5] text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)]'
                    : 'border-[#818080]/50 bg-white text-[#292727] hover:border-[#818080]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="m-0 mb-2 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
              Describe the Problem
            </h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Screen cracked"
              className="box-border h-[109px] w-full resize-none rounded-[10px] border border-[#818080] p-3 font-[SF_Pro,system-ui,sans-serif] text-[13px] text-[#333333] outline-none focus:border-[#0255AF]"
            />
          </div>

          <div>
            <h3 className="m-0 mb-2 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
              Photo
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="box-border flex h-[109px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-[#818080] bg-white"
            >
              <img src={photoIcon} alt="" className="h-8 w-8 opacity-70" />
              <span className="font-[SF_Pro,system-ui,sans-serif] text-[11px] text-[#484040]">
                {photo ? photo.name : 'Upload Image'}
              </span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
          className="mb-5 box-border flex w-full cursor-pointer items-center gap-4 rounded-[10px] border border-[#818080] bg-white px-5 py-3 text-left"
        >
          <img src={calendarIcon} alt="" className="h-9 w-9 flex-none" />
          <span>
            <span className="block font-[SF_Pro,system-ui,sans-serif] text-[14px] font-bold text-[#484040]">
              Preferred Appointment
            </span>
            <span className="block font-[SF_Pro,system-ui,sans-serif] text-[12px] text-[#484040]">
              {appointmentLabel || 'Choose a date and time'}
            </span>
          </span>
        </button>

        <h3 className="m-0 mb-2 font-[Roboto] text-[16px] font-semibold text-[#292727] sm:text-[18px]">
          Location
        </h3>
        <div className="mb-6">
          <LocationField coords={coords} status={locationStatus} />
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting}
          className="mx-auto box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Saving…' : 'Next'}
        </button>
        {error && (
          <p role="alert" className="m-0 mt-3 text-center font-[Roboto] text-[13px] text-[#B91C1C]">
            {error}
          </p>
        )}
      </div>

      {isCalendarOpen && (
        <AppointmentModal
          initialDate={appointment?.date}
          onClose={() => setIsCalendarOpen(false)}
          onConfirm={handleConfirmAppointment}
        />
      )}
    </CustomerSidebar>
  );
}