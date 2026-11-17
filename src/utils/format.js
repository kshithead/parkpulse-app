// Formatting + geo helpers shared across the UI.

export function normalizePlate(input) {
  if (typeof input !== 'string') return null;
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3]}-${m[4]}` : null;
}

/** Light-touch formatting while typing: uppercase and keep only plate characters. */
export function cleanPlateInput(value) {
  return value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 14);
}

/** 95 -> "1h 35m", 40 -> "40m", 0 -> "<1m" */
export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export function minutesSince(iso, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function timeAgo(iso, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

export const formatDateTime = (iso) => `${formatDate(iso)}, ${formatTime(iso)}`;

export const statusLabel = (s) =>
  ({
    pending: 'Pending review',
    investigating: 'Investigating',
    warning_issued: 'Notice issued',
    resolved: 'Resolved',
    dismissed: 'Dismissed'
  })[s] || s;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null) return '—';
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`;
}

// Average walking pace ~5 km/h; on-campus driving ~20 km/h (speed breakers, pedestrians).
export const walkMinutes = (km) => Math.max(1, Math.round((km / 5) * 60));
export const driveMinutes = (km) => Math.max(1, Math.round((km / 20) * 60));

export function nextSlotCode(slots) {
  const max = slots.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0);
  return `P${String(max + 1).padStart(3, '0')}`;
}

/** Extract a bay code from a scanned QR payload: a URL (?code=P001), a placard id, or a raw code. */
export function parseBayCode(payload, slots = []) {
  if (!payload) return null;
  const text = String(payload).trim();
  try {
    const url = new URL(text);
    const c = url.searchParams.get('code');
    if (c) return c.toUpperCase();
  } catch {
    /* not a URL */
  }
  const upper = text.toUpperCase();
  const byPlacard = slots.find((s) => s.qrPlacardId === upper);
  if (byPlacard) return byPlacard.code;
  return /^[A-Z0-9-]{2,10}$/.test(upper) ? upper : null;
}
