// ParkPulse API client. Talks to the Express backend (same origin in production,
// proxied by Vite in development). There is no offline/mock fallback: the server is
// the single source of truth so every connected device sees the same live state.

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'parkpulse_token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* storage unavailable */
}

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const session = {
  get token() {
    return token;
  },
  set(value) {
    token = value;
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
  onUnauthorized(fn) {
    unauthorizedHandler = fn;
  }
};

async function request(method, path, body, { auth = true } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the ParkPulse server. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    if (res.status === 401 && auth && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`);
  }
  return data;
}

export const api = {
  health: () => request('GET', '/health', undefined, { auth: false }),
  overview: () => request('GET', '/public/overview', undefined, { auth: false }),

  login: (payload) => request('POST', '/auth/login', payload, { auth: false }),
  register: (payload) => request('POST', '/auth/register', payload, { auth: false }),
  logout: () => request('POST', '/auth/logout', {}),
  me: () => request('GET', '/auth/me'),
  updateMe: (payload) => request('PATCH', '/auth/me', payload),

  state: () => request('GET', '/state'),
  lookupSlot: (code) => request('GET', `/slots/qr/${encodeURIComponent(code)}`),

  startSession: (payload) => request('POST', '/sessions/start', payload),
  endSession: (sessionId) => request('POST', '/sessions/end', sessionId ? { sessionId } : {}),

  patchSlot: (id, payload) => request('PATCH', `/slots/${id}`, payload),
  createSlot: (payload) => request('POST', '/slots', payload),
  deleteSlot: (id) => request('DELETE', `/slots/${id}`),
  createZone: (payload) => request('POST', '/zones', payload),
  updateZone: (zone, payload) => request('PATCH', `/zones/${encodeURIComponent(zone)}`, payload),

  reportViolation: (payload) => request('POST', '/violations', payload),
  updateViolationStatus: (id, status, note) => request('PATCH', `/violations/${id}/status`, { status, note }),
  uploadEvidence: (dataUrl) => request('POST', '/uploads', { dataUrl }),

  markNotificationsRead: (ids) => request('POST', '/notifications/read', ids ? { ids } : {}),

  analytics: () => request('GET', '/admin/analytics'),
  logs: (limit = 150) => request('GET', `/admin/logs?limit=${limit}`),
  resetData: (mode) => request('POST', '/admin/reset', { mode }),

  eventTicket: () => request('POST', '/events/ticket', {}),
  eventsUrl: (ticket) => `${BASE}/api/v1/events?ticket=${encodeURIComponent(ticket)}`
};
