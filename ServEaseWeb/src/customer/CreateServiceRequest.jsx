import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import {
  FALLBACK_APPOINTMENT_HOURS,
  buildSlots,
  isPastSlotToday,
  parseAppointmentHours,
  slotToMinutes,
} from '../utils/appointmentSlots';
import ExitRequestControl from '../components/ExitRequestControl.jsx';
import {
  createServiceRequest,
  getAppointmentSlots,
  getServiceRequestOptions,
  setDraftRequestId,
} from '../api/client';
import calendarIcon from '../assets/icon_calendar.png';
import photoIcon from '../assets/icon_photo.png';

// Everything the form offers — the categories, the service location types, the appointment
// time slots, the search-radius range and where the map opens — comes from the backend
// (GET /api/service-requests/options, see getServiceRequestOptions in api/client). Nothing about
// them is hard-coded here. A list entry is { value, label } (`value` is what is sent back to the
// backend, `label` is what the customer sees); a plain string is accepted too and used for both.
const toOption = (item) =>
  typeof item === 'string'
    ? { value: item, label: item }
    : {
        value: item.value ?? item.name ?? item.id,
        label: item.label ?? item.name ?? String(item.value ?? item.id ?? ''),
      };

// Photo / video limits come from the backend (`uploadLimits` in GET /service-requests/options).
// These values are only a fallback for when the backend does not send them yet.
const FALLBACK_UPLOAD_LIMITS = { maxImages: 4, maxVideos: 1, maxImageMb: 10, maxVideoMb: 50 };
const BYTES_PER_MB = 1024 * 1024;

// Google Maps JavaScript API key. Add VITE_GOOGLE_MAPS_API_KEY=... to your .env (Maps JavaScript API enabled).
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Loads the Google Maps script once and resolves with `google.maps`.
let googleMapsPromise = null;
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly`;
      script.async = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => {
        googleMapsPromise = null;
        reject(new Error('Google Maps failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return googleMapsPromise;
}

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
    <div className="mb-8 flex w-full gap-3">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-[9px] flex-1 rounded-[10px] ${i < activeStep ? 'bg-[#0255AF]' : 'bg-[#D9D9D9]'}`}
        />
      ))}
    </div>
  );
}

// A slot from the backend is either "9:00 AM" or { time, available }.
const normalizeSlot = (slot) =>
  typeof slot === 'string'
    ? { time: slot, available: true }
    : {
        time: slot.time ?? slot.label ?? slot.value,
        available: slot.available !== false && !slot.booked,
      };

// Appointment date/time picker modal. The time slots come from the backend; when the customer picks a
// day, `loadSlots(date)` asks the backend which of that day's slots are still free (a slot that is
// already booked is shown disabled). Selecting a date and a time and pressing Confirm hands the chosen
// appointment back to the parent form.
function AppointmentModal({ initialDate, hours, loadSlots, onClose, onConfirm }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = initialDate || today;

  const [viewYear, setViewYear] = useState(start.getFullYear());
  const [viewMonth, setViewMonth] = useState(start.getMonth());
  const [selectedDate, setSelectedDate] = useState(start);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Every slot of the booking hours (9 AM - 4 PM, hourly). Always complete, never outside the window.
  const baseSlots = useMemo(
    () => buildSlots(hours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours.startMinutes, hours.endMinutes, hours.stepMinutes]
  );
  const [slots, setSlots] = useState(baseSlots);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const grid = buildMonthGrid(viewYear, viewMonth);
  const selectedKey = toDateKey(selectedDate);

  // Re-check the slots every time the day changes.
  useEffect(() => {
    let cancelled = false;
    setSelectedSlot(null);
    setSlotsLoading(true);
    Promise.resolve(loadSlots ? loadSlots(selectedDate) : null)
      .then((list) => {
        if (cancelled) return;
        // The backend says which slots are taken; every other slot of the day stays available.
        const taken = new Map(
          (Array.isArray(list) ? list : []).map(normalizeSlot).map((x) => [slotToMinutes(x.time), x.available])
        );
        setSlots(baseSlots.map((slot) => ({ ...slot, available: taken.get(slot.minutes) ?? true })));
      })
      .catch(() => {
        if (!cancelled) setSlots(baseSlots); // availability could not be checked: offer the plain list
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Today's slots that have already started can't be chosen.
  const isPastSlot = (time) => isPastSlotToday(time, selectedKey === toDateKey(new Date()));

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
        className="relative box-border max-h-full w-full max-w-[340px] overflow-y-auto rounded-2xl bg-white p-6 font-[Roboto]"
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
        {slotsLoading && <p className="m-0 mb-2 text-[11px] text-[#817C7C]">Checking availability…</p>}
        <div className="grid grid-cols-2 gap-2">
          {slots.length === 0 && (
            <p className="col-span-2 m-0 text-[12px] text-[#817C7C]">No time slots available</p>
          )}
          {slots.map(({ time, available }) => {
            const disabled = !available || isPastSlot(time);
            const chosen = time === selectedSlot;
            return (
              <button
                key={time}
                type="button"
                disabled={disabled}
                title={disabled ? 'This time is not available' : undefined}
                onClick={() => setSelectedSlot(time)}
                className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
                  disabled
                    ? 'cursor-not-allowed border-[#EEE8E8] bg-[#F5F3F3] text-black/30 line-through'
                    : chosen
                    ? 'cursor-pointer border-black bg-black text-white'
                    : 'cursor-pointer border-[#DAD2D2] bg-white text-black hover:border-black/40'
                }`}
              >
                {time}
              </button>
            );
          })}
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

// One photo / video thumbnail in the upload box, with a remove button.
function MediaThumb({ item, onRemove }) {
  return (
    <div className="relative h-[72px] w-[72px] flex-none">
      {item.isVideo ? (
        <>
          <video src={item.url} muted preload="metadata" className="h-full w-full rounded-md object-cover" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/30">
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          </span>
        </>
      ) : (
        <img src={item.url} alt="" className="h-full w-full rounded-md object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
        className="absolute -right-[6px] -top-[6px] flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-[#292727] p-0"
      >
        <X size={12} color="#FFFFFF" />
      </button>
    </div>
  );
}

// Service Location Type dropdown (Home-based / Shop-based). The menu floats over the content
// below it (the map), like the Figma open state, and closes on outside click or Escape.
function LocationTypeSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = options.find((t) => t.value === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="box-border flex h-[65px] w-full cursor-pointer items-center justify-between rounded-[10px] border border-[#818080] bg-white px-6 text-left"
      >
        <span
          className={`font-[SF_Pro,system-ui,sans-serif] text-[14px] ${
            selected ? 'text-black' : 'text-[#484040]'
          }`}
        >
          {selected ? selected.label : 'Service Location Type'}
        </span>
        <ChevronDown
          size={22}
          color="#7C7979"
          className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 m-0 mt-1 list-none overflow-hidden rounded-[10px] border border-[#818080] bg-white p-0 shadow-[0_4px_10px_rgba(0,0,0,0.15)]"
        >
          {options.map((type, index) => (
            <li key={type.value} role="option" aria-selected={type.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(type.value);
                  setOpen(false);
                }}
                className={`box-border flex h-[48px] w-full cursor-pointer items-center border-none bg-white px-6 text-left font-[SF_Pro,system-ui,sans-serif] text-[14px] text-black hover:bg-[#EEF4FB] ${
                  index > 0 ? 'border-t border-solid border-t-[#E5E5E5]' : ''
                } ${type.value === value ? 'font-bold' : ''}`}
              >
                {type.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Keyless fallback used when the Maps JavaScript API can't load (no/invalid key): a regular Google
// map (same look as the mobile app: roads, landmarks, labels) with the search radius drawn on top.
// The zoom level is picked so the circle fits the box, and the circle's pixel size is computed
// from that zoom so it matches the real distance. It is not draggable; use "Update location".
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03392;

function EmbedMap({ coords, fallbackCenter, radiusKm }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const center = coords || fallbackCenter || null;
  const cosLat = center ? Math.cos((center.lat * Math.PI) / 180) : 1;
  const radiusM = (radiusKm ?? 0) * 1000;
  const targetDiameter = 0.7 * Math.min(size.w || 400, size.h || 300);
  const zoom = coords
    ? radiusM > 0
      ? Math.max(
          3,
          Math.min(20, Math.floor(Math.log2((METERS_PER_PIXEL_AT_ZOOM_0 * cosLat * targetDiameter) / (2 * radiusM))))
        )
      : 15
    : 14;
  const diameter = (2 * radiusM * 2 ** zoom) / (METERS_PER_PIXEL_AT_ZOOM_0 * cosLat);

  return (
    <div ref={wrapRef} className="absolute inset-0 z-10 bg-[#EDF2F8]">
      {center && (
        <iframe
          title="Service location map"
          src={`https://maps.google.com/maps?q=${center.lat},${center.lng}&z=${zoom}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      )}
      {coords && radiusM > 0 && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0255AF] bg-[#0255AF]/10"
          style={{ width: diameter, height: diameter }}
        />
      )}
    </div>
  );
}

// Google map showing the customer's location pin and a circle for the search radius.
// The pin can be dragged (or the map clicked) to correct the location — also the way to set it
// when device geolocation is denied. Falls back to a plain placeholder if the map can't load
// (missing/invalid VITE_GOOGLE_MAPS_API_KEY, offline, etc.).
function LocationMap({ coords, fallbackCenter, status, radiusKm, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [mapState, setMapState] = useState('loading'); // 'loading' | 'ready' | 'error'

  // The map opens on the customer's location, or on the backend's default center until it resolves.
  const startCenter = coords || fallbackCenter || null;
  const startCenterRef = useRef(startCenter);
  startCenterRef.current = startCenter;
  const hasStartCenter = Boolean(startCenter);

  // Create the map once there is somewhere to open it.
  useEffect(() => {
    if (!hasStartCenter) return undefined;
    let cancelled = false;
    let map = null;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const start = startCenterRef.current;
        map = new maps.Map(containerRef.current, {
          center: start,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        });
        const marker = new maps.Marker({ map, position: start, draggable: true, visible: false });
        const circle = new maps.Circle({
          map,
          center: start,
          radius: 1000, // set from the slider as soon as the customer's location is known
          strokeColor: '#0255AF',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#0255AF',
          fillOpacity: 0.12,
          clickable: false,
          visible: false,
        });
        const pick = (latLng) => onPickRef.current({ lat: latLng.lat(), lng: latLng.lng() });
        map.addListener('click', (e) => pick(e.latLng));
        marker.addListener('dragend', (e) => pick(e.latLng));
        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setMapState('ready');
      })
      .catch(() => {
        if (!cancelled) setMapState('error');
      });
    return () => {
      cancelled = true;
      if (map && window.google?.maps) window.google.maps.event.clearInstanceListeners(map);
    };
  }, [hasStartCenter]);

  // Keep the pin, the radius circle and the viewport in step with the coordinates and slider.
  useEffect(() => {
    if (mapState !== 'ready' || !coords) return;
    markerRef.current.setPosition(coords);
    markerRef.current.setVisible(true);
    circleRef.current.setCenter(coords);
    if (radiusKm > 0) {
      circleRef.current.setRadius(radiusKm * 1000);
      circleRef.current.setVisible(true);
      mapRef.current.fitBounds(circleRef.current.getBounds(), 24);
    } else {
      circleRef.current.setVisible(false);
      mapRef.current.setCenter(coords);
      mapRef.current.setZoom(15);
    }
  }, [mapState, coords, radiusKm]);

  const caption =
    coords
      ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      : status === 'denied' || status === 'unsupported'
      ? 'Location access denied — allow location access, then press Update location'
      : 'Detecting your location…';

  return (
    <div className="relative box-border h-[300px] w-full overflow-hidden rounded-[33px] border border-[#818080]/30 bg-[#EDF2F8] sm:h-[360px]">
      <div ref={containerRef} className="absolute inset-0" />

      {mapState === 'error' && <EmbedMap coords={coords} fallbackCenter={fallbackCenter} radiusKm={radiusKm} />}

      <span className="absolute bottom-3 left-3 z-20 rounded-md bg-white/90 px-2 py-1 font-[Roboto] text-[12px] text-[#414141] shadow-sm">
        {caption}
      </span>
    </div>
  );
}

// Slider for how far from the customer's location providers are searched (km).
function RadiusSlider({ value, min, max, onChange }) {
  return (
    <div className="box-border w-full rounded-[10px] border border-[#818080] bg-white px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-[SF_Pro,system-ui,sans-serif] text-[14px] font-bold text-[#484040]">Search radius</span>
        <span className="font-[SF_Pro,system-ui,sans-serif] text-[14px] font-bold text-[#0255AF]">{value} km</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Search radius in kilometers"
        className="h-2 w-full cursor-pointer accent-[#0255AF]"
      />
      <div className="mt-1 flex justify-between font-[SF_Pro,system-ui,sans-serif] text-[11px] text-[#7C7979]">
        <span>{min} km</span>
        <span>{max} km</span>
      </div>
      <p className="m-0 mt-2 font-[SF_Pro,system-ui,sans-serif] text-[12px] text-[#484040]">
        We&apos;ll recommend service providers within this distance from your location.
      </p>
    </div>
  );
}

const SECTION_HEADING = 'm-0 mb-3 font-[Roboto] text-[18px] font-semibold text-[#292727] sm:text-[20px]';

export default function CreateServiceRequest() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]); // [{ file, url, isVideo: false }] — up to maxImages
  const [video, setVideo] = useState(null); // { file, url, isVideo: true } — up to maxVideos (1)
  const [mediaError, setMediaError] = useState('');
  const [appointment, setAppointment] = useState(null); // { date: Date, time: string }
  const [serviceLocationType, setServiceLocationType] = useState(''); // 'home' | 'shop'
  const [searchRadiusKm, setSearchRadiusKm] = useState(null); // km, set from the backend's default once the options load
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form options from the backend (see toOption above).
  const [options, setOptions] = useState(null);
  const [optionsStatus, setOptionsStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  const [optionsReload, setOptionsReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setOptionsStatus('loading');
    getServiceRequestOptions()
      .then((data) => {
        if (cancelled) return;
        const radius = data?.searchRadius || {};
        const minKm = Number(radius.minKm);
        const maxKm = Number(radius.maxKm);
        const defaultKm = Number(radius.defaultKm);
        const hasRange = Number.isFinite(minKm) && Number.isFinite(maxKm) && maxKm > minKm;
        const c = data?.defaultMapCenter;
        const hasCenter = c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng));
        setOptions({
          categories: (data?.categories ?? []).map(toOption),
          locationTypes: (data?.locationTypes ?? []).map(toOption),
          timeSlots: data?.timeSlots ?? [],
          radiusRange: hasRange ? { min: minKm, max: maxKm } : null,
          defaultMapCenter: hasCenter ? { lat: Number(c.lat), lng: Number(c.lng) } : null,
          uploadLimits: { ...FALLBACK_UPLOAD_LIMITS, ...(data?.uploadLimits || {}) },
          appointmentHours: parseAppointmentHours(data?.appointmentHours),
        });
        if (hasRange) {
          setSearchRadiusKm(
            Number.isFinite(defaultKm) ? Math.min(maxKm, Math.max(minKm, defaultKm)) : minKm
          );
        }
        setOptionsStatus('done');
      })
      .catch(() => {
        if (!cancelled) setOptionsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [optionsReload]);

  // Device geolocation (the customer can then fine-tune it on the map). The coordinates and the
  // search radius are sent with the request when the customer presses Next.
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading'); // 'loading' | 'ready' | 'denied' | 'unsupported'

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus('ready');
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Human-readable address under the map (OpenStreetMap Nominatim reverse geocoding, no key needed).
  // TODO: swap for the backend's GET /location/reverse-geocode if you want the same address text as mobile.
  const [address, setAddress] = useState('');
  useEffect(() => {
    if (!coords) return undefined;
    const controller = new AbortController();
    setAddress('');
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&accept-language=en`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAddress(data?.display_name || ''))
      .catch(() => {});
    return () => controller.abort();
  }, [coords]);

  const appointmentLabel = formatAppointment(appointment?.date, appointment?.time);

  const limits = options?.uploadLimits ?? FALLBACK_UPLOAD_LIMITS;

  // Adds the chosen files: up to `maxImages` photos (each up to `maxImageMb`) and one video
  // (up to `maxVideoMb`). Anything over a limit is skipped with a message.
  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // so picking the same file again still fires onChange
    if (files.length === 0) return;

    const nextPhotos = [...photos];
    let nextVideo = video;
    const problems = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        if (nextPhotos.length >= limits.maxImages) {
          problems.push(`You can add up to ${limits.maxImages} photos.`);
        } else if (file.size > limits.maxImageMb * BYTES_PER_MB) {
          problems.push(`"${file.name}" is over ${limits.maxImageMb} MB.`);
        } else {
          nextPhotos.push({ file, url: URL.createObjectURL(file), isVideo: false });
        }
      } else if (file.type.startsWith('video/')) {
        if (nextVideo || limits.maxVideos < 1) {
          problems.push(`You can add only ${limits.maxVideos} video.`);
        } else if (file.size > limits.maxVideoMb * BYTES_PER_MB) {
          problems.push(`"${file.name}" is over ${limits.maxVideoMb} MB.`);
        } else {
          nextVideo = { file, url: URL.createObjectURL(file), isVideo: true };
        }
      } else {
        problems.push(`"${file.name}" is not a photo or video.`);
      }
    });

    setPhotos(nextPhotos);
    setVideo(nextVideo);
    setMediaError([...new Set(problems)].join(' '));
  };

  const removePhoto = (index) => {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
    setMediaError('');
  };

  const removeVideo = () => {
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setMediaError('');
  };

  const mediaItems = [...photos, ...(video ? [video] : [])];
  const canAddMore = photos.length < limits.maxImages || (!video && limits.maxVideos > 0);

  // Release the preview URLs when leaving the screen.
  const mediaUrlsRef = useRef([]);
  mediaUrlsRef.current = mediaItems.map((m) => m.url);
  useEffect(
    () => () => mediaUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)),
    []
  );

  // Which appointment times are still free on a day (asks the backend; see getAppointmentSlots).
  const loadSlots = (date) =>
    getAppointmentSlots({
      date: toDateKey(date),
      category,
      latitude: coords?.lat,
      longitude: coords?.lng,
      radiusKm: searchRadiusKm,
    }).then((data) => data?.slots ?? data?.timeSlots ?? null);

  const handleConfirmAppointment = (date, time) => {
    setAppointment({ date, time });
    setIsCalendarOpen(false);
  };

  const handlePickLocation = (picked) => {
    setCoords(picked);
    setLocationStatus('ready');
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
    if (!serviceLocationType) {
      setError('Please choose a service location type (home-based or shop-based).');
      return;
    }
    if (!coords) {
      setError('We need your location to find service providers near you.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('serviceLocationType', serviceLocationType); // "home" | "shop"
      photos.forEach((p) => formData.append('photos', p.file)); // up to 4 images
      if (video) formData.append('video', video.file); // 1 video
      if (appointment) {
        formData.append('appointmentDate', toDateKey(appointment.date)); // "YYYY-MM-DD"
        formData.append('appointmentTime', appointment.time);
      }
      formData.append('latitude', coords.lat);
      formData.append('longitude', coords.lng);
      if (searchRadiusKm != null) formData.append('searchRadiusKm', searchRadiusKm);

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
      <div className="relative box-border w-full px-5 py-8 sm:px-10 lg:py-10 lg:pl-[47px] lg:pr-[57px]">
        <ExitRequestControl />
        <h1 className="m-0 mb-4 font-[Quicksand] text-[32px] font-bold leading-tight text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Creating Service Request
        </h1>
        <StepProgress activeStep={1} />

        <h2 className="m-0 mb-2 font-[Roboto] text-[18px] font-semibold text-[#292727] sm:text-[20px]">
          What needs fixing?
        </h2>
        <p className="m-0 mb-8 font-[Roboto] text-[16px] text-[#414141] sm:text-[20px]">
          Pick a category and tell us what&apos;s going on — the more detail, the better the diagnosis.
        </p>

        <h3 className={SECTION_HEADING}>Category</h3>
        {optionsStatus === 'loading' && (
          <p className="m-0 mb-8 font-[Roboto] text-[14px] text-[#817C7C]">Loading categories…</p>
        )}
        {optionsStatus === 'error' && (
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <p role="alert" className="m-0 font-[Roboto] text-[14px] text-[#B91C1C]">
              Couldn&apos;t load the form options.
            </p>
            <button
              type="button"
              onClick={() => setOptionsReload((n) => n + 1)}
              className="cursor-pointer border-none bg-transparent p-0 font-[Roboto] text-[14px] font-medium text-[#0255AF] underline"
            >
              Try again
            </button>
          </div>
        )}
        {optionsStatus === 'done' && options.categories.length === 0 && (
          <p className="m-0 mb-8 font-[Roboto] text-[14px] text-[#817C7C]">No categories available.</p>
        )}
        {optionsStatus === 'done' && options.categories.length > 0 && (
          <div className="mb-8 flex flex-wrap justify-center gap-x-[33px] gap-y-4">
            {options.categories.map((c) => {
              const active = c.value === category;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  aria-pressed={active}
                  className={`box-border h-[42px] w-[188px] max-w-full cursor-pointer rounded-[10px] border border-[#818080] bg-gradient-to-r from-[#0255AF] to-[#04A5A5] px-4 font-[Roboto] text-[14px] font-normal leading-[16px] text-white shadow-[0_4px_4px_rgba(0,0,0,0.25)] transition ${
                    active ? 'ring-2 ring-[#021E79] ring-offset-2' : 'hover:brightness-110'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-8 grid gap-x-10 gap-y-6 lg:grid-cols-2">
          <div>
            <h3 className={SECTION_HEADING}>Describe the Problem</h3>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Screen cracked"
              className="box-border h-[109px] w-full resize-none rounded-[10px] border border-[#818080] bg-white p-4 font-[SF_Pro,system-ui,sans-serif] text-[14px] text-[#333333] outline-none placeholder:text-[#333333]/60 focus:border-[#0255AF]"
            />
          </div>

          <div>
            <h3 className={SECTION_HEADING}>Photo &amp; Video</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleMediaChange}
              className="hidden"
            />
            {mediaItems.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="box-border flex h-[109px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-[#818080] bg-white"
              >
                <img src={photoIcon} alt="" className="h-[51px] w-[52px] object-contain opacity-90" />
                <span className="font-[SF_Pro,system-ui,sans-serif] text-[10px] leading-[12px] text-[#484040]">
                  Upload Image
                </span>
              </button>
            ) : (
              <div className="box-border flex h-[109px] w-full items-center gap-3 overflow-x-auto rounded-[10px] border border-[#818080] bg-white px-4">
                {photos.map((item, index) => (
                  <MediaThumb key={item.url} item={item} onRemove={() => removePhoto(index)} />
                ))}
                {video && <MediaThumb item={video} onRemove={removeVideo} />}
                {canAddMore && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add more photos or video"
                    className="flex h-[72px] w-[72px] flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#818080] bg-white p-0"
                  >
                    <img src={photoIcon} alt="" className="h-6 w-6 object-contain opacity-80" />
                    <span className="font-[SF_Pro,system-ui,sans-serif] text-[10px] leading-[12px] text-[#484040]">
                      Add
                    </span>
                  </button>
                )}
              </div>
            )}
            <p className="m-0 mt-1 font-[SF_Pro,system-ui,sans-serif] text-[11px] leading-[14px] text-[#817C7C]">
              {photos.length}/{limits.maxImages} photos (max {limits.maxImageMb} MB each) · {video ? 1 : 0}/
              {limits.maxVideos} video (max {limits.maxVideoMb} MB)
            </p>
            {mediaError && (
              <p role="alert" className="m-0 mt-1 font-[Roboto] text-[12px] text-[#B91C1C]">
                {mediaError}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="box-border flex h-[65px] w-full cursor-pointer items-center gap-4 rounded-[10px] border border-[#818080] bg-white px-5 text-left"
          >
            <img src={calendarIcon} alt="" className="h-11 w-11 flex-none" />
            <span>
              <span className="block font-[SF_Pro,system-ui,sans-serif] text-[14px] font-bold text-[#484040]">
                Preferred Appointment
              </span>
              <span className="block font-[SF_Pro,system-ui,sans-serif] text-[12px] text-[#484040]">
                {appointmentLabel || 'Choose a date and time'}
              </span>
            </span>
          </button>

          <LocationTypeSelect
            options={options?.locationTypes ?? []}
            value={serviceLocationType}
            onChange={setServiceLocationType}
          />
        </div>

        <h3 className={SECTION_HEADING}>Location</h3>
        <div className="mb-3">
          <LocationMap
            coords={coords}
            fallbackCenter={options?.defaultMapCenter ?? null}
            status={locationStatus}
            radiusKm={searchRadiusKm}
            onPick={handlePickLocation}
          />
        </div>
        <p className="m-0 mb-1 font-[Roboto] text-[15px] text-[#414141]">
          {address || (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Location not set yet')}
        </p>
        <button
          type="button"
          onClick={requestLocation}
          className="mb-5 cursor-pointer border-none bg-transparent p-0 font-[Roboto] text-[15px] font-medium text-[#0255AF] underline"
        >
          Update location
        </button>
        {options?.radiusRange && searchRadiusKm != null ? (
          <div className="mb-10">
            <RadiusSlider
              value={searchRadiusKm}
              min={options.radiusRange.min}
              max={options.radiusRange.max}
              onChange={setSearchRadiusKm}
            />
          </div>
        ) : (
          <div className="mb-10" />
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting || optionsStatus !== 'done'}
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
          hours={options?.appointmentHours ?? FALLBACK_APPOINTMENT_HOURS}
          loadSlots={loadSlots}
          onClose={() => setIsCalendarOpen(false)}
          onConfirm={handleConfirmAppointment}
        />
      )}
    </CustomerSidebar>
  );
}