// Universal appointment grid shared by customer booking and provider Manage Calendar.
// Profile working hours are informational and deliberately do not alter these slots.
const APPOINTMENT_HOURS = Object.freeze({ start: '09:00 AM', end: '04:00 PM', stepMinutes: 60 });
const APPOINTMENT_SLOTS_24 = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `${String(9 + index).padStart(2, '0')}:00`)
);

const formatAppointmentSlot = (slot24) => {
  const hour = Number(String(slot24).slice(0, 2));
  return `${String(hour % 12 || 12).padStart(2, '0')}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
};

// Extra blocked slots outside the universal grid do not prevent a whole-day block being recognized.
const isWholeDayBlocked = (slots) => APPOINTMENT_SLOTS_24.every((slot) => slots.has(slot));

module.exports = {
  APPOINTMENT_HOURS,
  APPOINTMENT_SLOTS_24,
  formatAppointmentSlot,
  isWholeDayBlocked,
};
