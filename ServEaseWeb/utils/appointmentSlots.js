// Appointment time slots, shared by the customer's "Preferred Appointment" calendar
// (CreateServiceRequest.jsx) and the provider's "Manage your Calendar" (ServiceProviderDashboard.jsx),
// so both always offer exactly the same times: 9:00 AM to 4:00 PM, one slot per hour.
//
// The booking hours can come from the backend as
//   appointmentHours: { start: '9:00 AM', end: '4:00 PM', stepMinutes: 60 }
// (GET /service-requests/options and GET /provider/dashboard); this fallback is used when it doesn't.

export const FALLBACK_APPOINTMENT_HOURS = { startMinutes: 9 * 60, endMinutes: 16 * 60, stepMinutes: 60 };

// "9:00 AM" / "09:00 AM" / "4:00 PM" -> minutes since midnight (null when it can't be read).
export const slotToMinutes = (label) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(label ?? '').trim());
  if (!m) return null;
  const hours = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return hours * 60 + Number(m[2]);
};

// 540 -> "09:00 AM", 720 -> "12:00 PM", 780 -> "01:00 PM" (the format saved availability already uses).
export const formatSlot = (minutes) => {
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
};

// Backend `appointmentHours` -> { startMinutes, endMinutes, stepMinutes }, or the fallback.
export const parseAppointmentHours = (hours) => {
  const startMinutes = slotToMinutes(hours?.start);
  const endMinutes = slotToMinutes(hours?.end);
  const stepMinutes = Number(hours?.stepMinutes) || FALLBACK_APPOINTMENT_HOURS.stepMinutes;
  return startMinutes != null && endMinutes != null && endMinutes >= startMinutes
    ? { startMinutes, endMinutes, stepMinutes }
    : FALLBACK_APPOINTMENT_HOURS;
};

// Every bookable time of a day, from the first to the last hour: 09:00 AM ... 04:00 PM.
export const buildSlots = ({ startMinutes, endMinutes, stepMinutes }) => {
  const slots = [];
  for (let m = startMinutes; m <= endMinutes; m += stepMinutes) {
    slots.push({ time: formatSlot(m), minutes: m, available: true });
  }
  return slots;
};

// True when a slot of TODAY has already started (so it can no longer be booked or changed).
export const isPastSlotToday = (time, isToday) => {
  if (!isToday) return false;
  const minutes = slotToMinutes(time);
  const now = new Date();
  return minutes != null && minutes <= now.getHours() * 60 + now.getMinutes();
};