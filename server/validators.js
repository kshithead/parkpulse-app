// Shared input validation helpers for the ParkPulse API.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);

/**
 * Normalise an Indian vehicle registration plate into "KA-03-HA-8820" form.
 * Returns null if the value is not a plausible plate.
 */
export function normalizePlate(input) {
  if (typeof input !== 'string') return null;
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3]}-${m[4]}`;
}

export function str(value, { min = 0, max = 200, field = 'Value' } = {}) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.length < min) throw badRequest(`${field} is required${min > 1 ? ` (min ${min} characters)` : ''}.`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return v;
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;
}

export function checkPassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw badRequest('Password must be at least 8 characters long.');
  }
  if (value.length > 100) throw badRequest('Password is too long.');
  return value;
}

export function num(value, { min = -Infinity, max = Infinity, field = 'Value', int = false } = {}) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) throw badRequest(`${field} must be a number.`);
  if (int && !Number.isInteger(n)) throw badRequest(`${field} must be a whole number.`);
  if (n < min || n > max) throw badRequest(`${field} must be between ${min} and ${max}.`);
  return n;
}

export const SLOT_TYPES = ['Standard', 'EV Charging', 'Accessible'];
export const SLOT_STATUSES = ['available', 'occupied', 'reserved', 'maintenance'];
export const VIOLATION_CATEGORIES = [
  'Unauthorized Parking',
  'Wrong Parking',
  'Blocked Parking',
  'Reserved Space Infringement',
  'No QR Check-In'
];
export const URGENCIES = ['low', 'medium', 'high', 'critical'];
export const VIOLATION_STATUSES = ['pending', 'investigating', 'warning_issued', 'resolved', 'dismissed'];

// Allowed enforcement state machine transitions.
export const VIOLATION_TRANSITIONS = {
  pending: ['investigating', 'warning_issued', 'resolved', 'dismissed'],
  investigating: ['warning_issued', 'resolved', 'dismissed'],
  warning_issued: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: []
};
