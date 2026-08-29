/**
 * Request validation helpers.
 * @format
 */

export const isEmail = value =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

export const findMissingFields = (source, fields) =>
  fields.filter(
    field =>
      source[field] === undefined ||
      source[field] === null ||
      String(source[field]).trim() === '',
  );

/**
 * Accepts arrays sent as a real array (JSON body), a JSON-encoded string,
 * or a comma-separated string (multipart form fields) and normalises them
 * to a clean string array.
 */
export const parseStringArray = value => {
  if (Array.isArray(value)) {
    return value.map(String).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value !== 'string') {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map(entry => entry.trim()).filter(Boolean);
    }
  } catch {
    // Not JSON - fall through to comma-separated parsing.
  }
  return trimmed.split(',').map(entry => entry.trim()).filter(Boolean);
};

/** Converts "MM/DD/YYYY" (mobile input) to an ISO "YYYY-MM-DD" date. */
export const toIsoDate = value => {
  const trimmed = String(value || '').trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (match) {
    return `${match[3]}-${match[1]}-${match[2]}`;
  }
  return trimmed;
};

export const isTruthy = value =>
  ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
