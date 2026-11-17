import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Store } from './store.js';
import { Mutex } from './redisStore.js';
import { buildInitialData, DEMO_ACCOUNTS } from './seed.js';
import { hashPassword, verifyPassword, newToken, digest, newId } from './security.js';
import {
  HttpError,
  badRequest,
  normalizePlate,
  str,
  num,
  isEmail,
  checkPassword,
  SLOT_TYPES,
  SLOT_STATUSES,
  VIOLATION_CATEGORIES,
  URGENCIES,
  VIOLATION_STATUSES,
  VIOLATION_TRANSITIONS
} from './validators.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const TOKEN_TTL = 7 * DAY;

const STATUS_LABEL = {
  pending: 'Pending review',
  investigating: 'Under investigation',
  warning_issued: 'Warning notice issued',
  resolved: 'Resolved',
  dismissed: 'Dismissed'
};

// `store` may be injected (RedisStore on serverless hosts); otherwise a local JSON file is used.
export async function createApp({ dbFile, uploadsDir, distDir, seedMode = 'demo', store: injected }) {
  const store = injected || new Store(dbFile);
  const remote = Boolean(store.remote);
  let db = await store.load(() => buildInitialData({ mode: seedMode }));
  db.meta.rev ??= 1;

  if (!remote) fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));

  // Evidence uploads carry base64 images; everything else is tiny JSON.
  app.use('/api/v1/uploads', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '100kb' }));
  if (remote) {
    // Photos live in Redis (serverless /tmp is per-instance), so serve them from there.
    app.get('/uploads/:name', async (req, res) => {
      const m = /^([a-f0-9]{16,}).(jpg|png|webp)$/.exec(req.params.name);
      const buf = m && (await store.getBlob(req.params.name).catch(() => null));
      if (!buf) return res.status(404).end();
      res.set({ 'Content-Type': { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[m[2]], 'Cache-Control': 'public, max-age=604800, immutable' });
      res.end(buf);
    });
  } else {
    app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }));
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------
  const nowIso = () => new Date().toISOString();
  const sseClients = new Set();
  const tickets = new Map();

  function broadcast() {
    const msg = `event: change\ndata: ${JSON.stringify({ rev: db.meta.rev })}\n\n`;
    for (const res of sseClients) res.write(msg);
  }

  /** Persist + notify all connected clients that state changed. */
  function commit() {
    // Keep the document bounded: drop the oldest finished sessions beyond 3000.
    if (db.sessions.length > 3000) {
      const keep = db.sessions.filter((s) => s.status === 'active');
      db.sessions = [...keep, ...db.sessions.filter((s) => s.status !== 'active').slice(0, 3000 - keep.length)];
    }
    db.meta.rev += 1;
    store.save();
    broadcast();
  }

  function log(level, source, message, actor = 'System') {
    db.logs.unshift({ id: newId('log'), at: nowIso(), level, source, message, actor });
    if (db.logs.length > 500) db.logs.length = 500;
  }

  function notify(userId, { type = 'info', title, message, link = null }) {
    if (!userId) return;
    db.notifications.unshift({ id: newId('ntf'), userId, type, title, message, link, read: false, createdAt: nowIso() });
    // keep per-user history bounded
    let n = 0;
    db.notifications = db.notifications.filter((x) => x.userId !== userId || ++n <= 50);
  }

  const publicUser = (u) => {
    const { passwordHash, ...rest } = u; // eslint-disable-line no-unused-vars
    return rest;
  };

  const zoneOf = (key) => db.zones.find((z) => z.zone === key);

  function slotView(slot, viewer) {
    const z = zoneOf(slot.zone);
    const view = {
      id: slot.id,
      code: slot.code,
      zone: slot.zone,
      zoneName: z?.name || slot.zone,
      level: slot.level,
      type: slot.type,
      status: slot.status,
      isEV: slot.type === 'EV Charging',
      isAccessible: slot.type === 'Accessible',
      qrPlacardId: slot.qrPlacardId,
      occupiedBy: null
    };
    if (slot.occupiedBy) {
      const mine = viewer && slot.occupiedBy.userId === viewer.id;
      view.occupiedBy =
        viewer?.role === 'admin' || mine
          ? { ...slot.occupiedBy, isMine: Boolean(mine) }
          : { startTime: slot.occupiedBy.startTime, isMine: false }; // other drivers' identity stays private
    }
    return view;
  }

  function zoneView(z) {
    const zs = db.slots.filter((s) => s.zone === z.zone);
    return {
      ...z,
      totalSlots: zs.length,
      availableSlots: zs.filter((s) => s.status === 'available').length,
      evSlots: zs.filter((s) => s.type === 'EV Charging').length,
      accessibleSlots: zs.filter((s) => s.type === 'Accessible').length
    };
  }

  function summary() {
    const total = db.slots.length;
    const count = (st) => db.slots.filter((s) => s.status === st).length;
    const occupied = count('occupied');
    return {
      totalSlots: total,
      availableSlots: count('available'),
      occupiedSlots: occupied,
      reservedSlots: count('reserved'),
      maintenanceSlots: count('maintenance'),
      occupancyPercentage: total ? Math.round((occupied / total) * 100) : 0,
      zoneCount: db.zones.length,
      activeSessions: db.sessions.filter((s) => s.status === 'active').length,
      openViolations: db.violations.filter((v) => v.status === 'pending' || v.status === 'investigating').length
    };
  }

  function buildState(user) {
    const isAdmin = user.role === 'admin';
    const byNewest = (a, b) => new Date(b.startTime || b.timestamp) - new Date(a.startTime || a.timestamp);
    const sessions = (isAdmin ? db.sessions : db.sessions.filter((s) => s.userId === user.id))
      .slice()
      .sort(byNewest)
      .slice(0, isAdmin ? 300 : 100);
    const violations = (isAdmin ? db.violations : db.violations.filter((v) => v.reporterId === user.id))
      .slice()
      .sort(byNewest);
    const activeSession = db.sessions.find((s) => s.userId === user.id && s.status === 'active') || null;
    // Notices issued against this driver's registered vehicle (reporter identity is not exposed).
    const notices = isAdmin
      ? []
      : db.violations
          .filter((v) => v.vehicleNumber === user.vehicleNumber && ['warning_issued', 'investigating'].includes(v.status))
          .map((v) => ({ id: v.id, category: v.category, zone: v.zone, status: v.status, adminNotes: v.adminNotes, timestamp: v.timestamp }));
    return {
      rev: db.meta.rev,
      serverTime: nowIso(),
      stats: summary(),
      zones: db.zones.map(zoneView),
      slots: db.slots.map((s) => slotView(s, user)),
      sessions,
      activeSession,
      violations,
      notices,
      notifications: db.notifications.filter((n) => n.userId === user.id).slice(0, 30)
    };
  }

  /** Close a session and free its bay. Shared by driver checkout, officer release and manual overrides. */
  function closeSession(session, endedBy, actorName) {
    const end = Date.now();
    session.status = 'completed';
    session.endTime = new Date(end).toISOString();
    session.durationMin = Math.max(1, Math.ceil((end - new Date(session.startTime).getTime()) / MIN));
    session.endedBy = endedBy;
    const slot = db.slots.find((s) => s.id === session.slotId);
    if (slot && slot.occupiedBy?.sessionId === session.sessionId) {
      slot.occupiedBy = null;
      if (slot.status === 'occupied') slot.status = 'available';
    }
    log(
      endedBy === 'admin' ? 'warning' : 'info',
      endedBy === 'admin' ? 'Admin-Console' : 'Session-Manager',
      `Bay ${session.slotCode} released after ${session.durationMin} min (${session.vehicleNumber})${endedBy === 'admin' ? ' by officer override' : ''}.`,
      actorName
    );
    return session;
  }

  // -------------------------------------------------------------------------
  // auth middleware
  // -------------------------------------------------------------------------
  function authenticate(req) {
    const header = req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!raw) return null;
    const hash = digest(raw);
    const rec = db.tokens.find((t) => t.hash === hash);
    if (!rec || rec.expiresAt < Date.now()) return null;
    const user = db.users.find((u) => u.id === rec.userId);
    return user ? { user, tokenHash: hash } : null;
  }

  const requireAuth = (req, res, next) => {
    const a = authenticate(req);
    if (!a) return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
    req.user = a.user;
    req.tokenHash = a.tokenHash;
    next();
  };

  const requireAdmin = (req, res, next) => {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (req.user.role !== 'admin') return next(new HttpError(403, 'Officer privileges are required for this action.'));
      next();
    });
  };

  function issueToken(user) {
    const token = newToken();
    db.tokens = db.tokens.filter((t) => t.expiresAt > Date.now());
    db.tokens.push({ hash: digest(token), userId: user.id, createdAt: nowIso(), expiresAt: Date.now() + TOKEN_TTL });
    return token;
  }

  // Basic brute-force protection for the login form.
  const attempts = new Map();
  function throttle(key) {
    const rec = attempts.get(key);
    if (rec && rec.resetAt > Date.now() && rec.count >= 8) {
      throw new HttpError(429, 'Too many failed sign-in attempts. Please wait a few minutes and try again.');
    }
  }
  function recordFailure(key) {
    const rec = attempts.get(key);
    if (!rec || rec.resetAt < Date.now()) attempts.set(key, { count: 1, resetAt: Date.now() + 10 * MIN });
    else rec.count += 1;
  }

  // -------------------------------------------------------------------------
  // public routes
  // -------------------------------------------------------------------------
  const api = express.Router();

  api.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'ParkPulse API',
      uptimeSec: Math.round(process.uptime()),
      timestamp: nowIso(),
      demoMode: db.meta.seedMode === 'demo',
      // redis = shared cloud database; file = local disk; ephemeral = serverless without a shared DB (sessions will not be reliable)
      storage: remote ? 'redis' : process.env.VERCEL ? 'ephemeral' : 'file',
      realtime: remote ? 'polling' : 'sse',
      // Only advertised for demo datasets so the login screen can offer one-click demo access.
      demoAccounts: db.meta.seedMode === 'demo' ? DEMO_ACCOUNTS : undefined,
      rev: db.meta.rev
    });
  });

  api.get('/public/overview', (req, res) => {
    res.json({
      ...summary(),
      zones: db.zones.map((z) => {
        const v = zoneView(z);
        return { zone: v.zone, name: v.name, totalSlots: v.totalSlots, availableSlots: v.availableSlots };
      })
    });
  });

  // -------------------------------------------------------------------------
  // auth
  // -------------------------------------------------------------------------
  api.post('/auth/register', async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, { min: 2, max: 60, field: 'Full name' });
    const email = String(b.email || '').trim().toLowerCase();
    if (!isEmail(email)) throw badRequest('Please enter a valid email address.');
    checkPassword(b.password);
    const plate = normalizePlate(b.vehicleNumber);
    if (!plate) throw badRequest('Enter a valid registration plate, for example KA-03-HA-8820.');
    if (db.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    if (db.users.some((u) => u.role === 'user' && u.vehicleNumber === plate)) {
      throw new HttpError(409, 'This vehicle is already registered to another account.');
    }
    const user = {
      id: newId('usr'),
      name,
      email,
      passwordHash: await hashPassword(b.password),
      role: 'user',
      phone: str(b.phone, { max: 20, field: 'Phone' }),
      vehicleNumber: plate,
      vehicleModel: str(b.vehicleModel, { max: 60, field: 'Vehicle model' }),
      createdAt: nowIso()
    };
    db.users.push(user);
    log('info', 'Accounts', `New driver registered: ${name} (${plate}).`, name);
    const token = issueToken(user);
    commit();
    res.status(201).json({ token, user: publicUser(user) });
  });

  api.post('/auth/login', async (req, res) => {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const portal = b.portal === 'admin' ? 'admin' : 'user';
    const key = `${req.ip}|${email}`;
    throttle(key);
    const user = db.users.find((u) => u.email === email);
    const valid = user ? await verifyPassword(String(b.password || ''), user.passwordHash) : false;
    if (!valid) {
      recordFailure(key);
      throw new HttpError(401, 'Incorrect email or password.');
    }
    if (portal === 'admin' && user.role !== 'admin') throw new HttpError(403, 'This account is not authorised for the Security Officer portal.');
    if (portal === 'user' && user.role === 'admin') throw new HttpError(403, 'Officer accounts must sign in through the Security Officer portal.');
    attempts.delete(key);
    const token = issueToken(user);
    log('info', 'Accounts', `${user.role === 'admin' ? 'Officer' : 'Driver'} signed in.`, user.name);
    commit();
    res.json({ token, user: publicUser(user) });
  });

  api.post('/auth/logout', requireAuth, (req, res) => {
    db.tokens = db.tokens.filter((t) => t.hash !== req.tokenHash);
    store.save();
    res.json({ success: true });
  });

  api.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  api.patch('/auth/me', requireAuth, (req, res) => {
    const b = req.body || {};
    const u = req.user;
    if (b.name !== undefined) u.name = str(b.name, { min: 2, max: 60, field: 'Full name' });
    if (b.phone !== undefined) u.phone = str(b.phone, { max: 20, field: 'Phone' });
    if (u.role === 'user') {
      if (b.vehicleNumber !== undefined) {
        const plate = normalizePlate(b.vehicleNumber);
        if (!plate) throw badRequest('Enter a valid registration plate, for example KA-03-HA-8820.');
        if (db.users.some((x) => x.id !== u.id && x.role === 'user' && x.vehicleNumber === plate)) {
          throw new HttpError(409, 'This vehicle is already registered to another account.');
        }
        u.vehicleNumber = plate;
      }
      if (b.vehicleModel !== undefined) u.vehicleModel = str(b.vehicleModel, { max: 60, field: 'Vehicle model' });
    }
    commit();
    res.json({ user: publicUser(u) });
  });

  // -------------------------------------------------------------------------
  // realtime (Server-Sent Events). EventSource cannot send headers, so the
  // client first exchanges its bearer token for a short-lived one-time ticket.
  // -------------------------------------------------------------------------
  api.post('/events/ticket', requireAuth, (req, res) => {
    // Serverless functions cannot hold a connection open: tell the client to poll instead.
    if (remote) throw new HttpError(501, 'Realtime push is not available on this deployment; using fast polling.');
    const ticket = crypto.randomBytes(16).toString('hex');
    tickets.set(ticket, Date.now() + 30 * 1000);
    for (const [k, exp] of tickets) if (exp < Date.now()) tickets.delete(k);
    res.json({ ticket });
  });

  api.get('/events', (req, res) => {
    const exp = tickets.get(String(req.query.ticket || ''));
    tickets.delete(String(req.query.ticket || ''));
    if (!exp || exp < Date.now()) return res.status(401).end();
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write(`retry: 3000\n\nevent: hello\ndata: ${JSON.stringify({ rev: db.meta.rev })}\n\n`);
    sseClients.add(res);
    const beat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(beat);
      sseClients.delete(res);
    });
  });

  // -------------------------------------------------------------------------
  // state snapshot
  // -------------------------------------------------------------------------
  api.get('/state', requireAuth, (req, res) => res.json(buildState(req.user)));

  api.get('/slots/qr/:code', requireAuth, (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const slot = db.slots.find((s) => s.code === code);
    if (!slot) throw new HttpError(404, `Bay "${code}" was not found. Check the code printed on the placard.`);
    res.json(slotView(slot, req.user));
  });

  // -------------------------------------------------------------------------
  // sessions
  // -------------------------------------------------------------------------
  api.post('/sessions/start', requireAuth, (req, res) => {
    const user = req.user;
    if (user.role === 'admin') throw new HttpError(403, 'Officer accounts cannot check in to a bay. Use a driver account.');
    const code = str(req.body?.slotCode, { min: 2, max: 12, field: 'Bay code' }).toUpperCase();
    const slot = db.slots.find((s) => s.code === code);
    if (!slot) throw new HttpError(404, `Bay "${code}" was not found.`);
    const plate = normalizePlate(req.body?.vehicleNumber || user.vehicleNumber);
    if (!plate) throw badRequest('Enter a valid registration plate, for example KA-03-HA-8820.');

    const mine = db.sessions.find((s) => s.userId === user.id && s.status === 'active');
    if (mine) throw new HttpError(409, `You already have an active session at bay ${mine.slotCode}. End it before checking in elsewhere.`);
    const dup = db.sessions.find((s) => s.vehicleNumber === plate && s.status === 'active');
    if (dup) throw new HttpError(409, `Vehicle ${plate} is already checked in at bay ${dup.slotCode}.`);
    if (slot.status !== 'available') {
      const why = { occupied: 'occupied by another vehicle', reserved: 'reserved for official use', maintenance: 'under maintenance' }[slot.status];
      throw new HttpError(409, `Bay ${slot.code} is ${why}. Please pick an available bay.`);
    }

    const session = {
      sessionId: newId('sess'),
      userId: user.id,
      slotId: slot.id,
      slotCode: slot.code,
      zone: slot.zone,
      vehicleNumber: plate,
      driverName: user.name,
      startTime: nowIso(),
      status: 'active'
    };
    db.sessions.unshift(session);
    slot.status = 'occupied';
    slot.occupiedBy = { sessionId: session.sessionId, userId: user.id, vehicleNumber: plate, driverName: user.name, startTime: session.startTime };
    log('success', 'QR-CheckIn', `Vehicle ${plate} checked into bay ${slot.code} (${slot.zone}).`, user.name);
    commit();
    res.status(201).json(session);
  });

  api.post('/sessions/end', requireAuth, (req, res) => {
    const user = req.user;
    const id = req.body?.sessionId;
    const session = id
      ? db.sessions.find((s) => s.sessionId === id)
      : db.sessions.find((s) => s.userId === user.id && s.status === 'active');
    if (!session) throw new HttpError(404, 'No active parking session found.');
    if (session.status !== 'active') throw new HttpError(409, 'This session has already ended.');
    const isOwner = session.userId === user.id;
    if (!isOwner && user.role !== 'admin') throw new HttpError(403, 'You can only end your own parking session.');
    closeSession(session, isOwner ? 'driver' : 'admin', user.name);
    if (!isOwner) {
      notify(session.userId, {
        type: 'warning',
        title: 'Parking session closed by an officer',
        message: `Your session at bay ${session.slotCode} was ended by campus security after ${session.durationMin} min.`,
        link: '/dashboard'
      });
    }
    commit();
    res.json(session);
  });

  // -------------------------------------------------------------------------
  // slots & zones (officer only)
  // -------------------------------------------------------------------------
  api.patch('/slots/:id', requireAdmin, (req, res) => {
    const slot = db.slots.find((s) => s.id === req.params.id);
    if (!slot) throw new HttpError(404, 'Bay not found.');
    const status = req.body?.status;
    if (!SLOT_STATUSES.includes(status)) throw badRequest('Invalid bay status.');
    const actor = req.user.name;

    if (status === 'occupied') {
      if (slot.status === 'occupied') return res.json(slotView(slot, req.user));
      if (slot.status !== 'available') throw new HttpError(409, `Bay ${slot.code} must be available before it can be marked occupied.`);
      const plate = normalizePlate(req.body?.vehicleNumber);
      if (!plate) throw badRequest('Enter the vehicle plate to record the occupancy, for example KA-03-HA-8820.');
      if (db.sessions.some((s) => s.vehicleNumber === plate && s.status === 'active')) {
        throw new HttpError(409, `Vehicle ${plate} already has an active session.`);
      }
      const session = {
        sessionId: newId('sess'),
        userId: null,
        slotId: slot.id,
        slotCode: slot.code,
        zone: slot.zone,
        vehicleNumber: plate,
        driverName: 'Walk-in / unscanned vehicle',
        startTime: nowIso(),
        status: 'active',
        source: 'officer'
      };
      db.sessions.unshift(session);
      slot.status = 'occupied';
      slot.occupiedBy = { sessionId: session.sessionId, userId: null, vehicleNumber: plate, driverName: session.driverName, startTime: session.startTime };
      log('warning', 'Slot-Manager', `Bay ${slot.code} manually marked occupied by officer (${plate}).`, actor);
    } else {
      if (slot.status === 'occupied') {
        const session = db.sessions.find((s) => s.sessionId === slot.occupiedBy?.sessionId);
        if (session) {
          closeSession(session, 'admin', actor);
          notify(session.userId, {
            type: 'warning',
            title: 'Parking session closed by an officer',
            message: `Bay ${session.slotCode} was released by campus security after ${session.durationMin} min.`,
            link: '/dashboard'
          });
        }
        slot.occupiedBy = null;
      }
      const before = slot.status;
      slot.status = status;
      if (before !== status) log('warning', 'Slot-Manager', `Bay ${slot.code} status changed ${before} → ${status}.`, actor);
    }
    commit();
    res.json(slotView(slot, req.user));
  });

  api.post('/slots', requireAdmin, (req, res) => {
    const b = req.body || {};
    const code = str(b.code, { min: 2, max: 10, field: 'Bay code' }).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(code)) throw badRequest('Bay code may only contain letters, numbers and dashes.');
    if (db.slots.some((s) => s.code === code)) throw new HttpError(409, `Bay ${code} already exists.`);
    const zone = zoneOf(b.zone);
    if (!zone) throw badRequest('Choose a valid zone.');
    const type = SLOT_TYPES.includes(b.type) ? b.type : 'Standard';
    const letter = zone.zone.replace('Zone ', '');
    const slot = {
      id: `s-${code.toLowerCase()}`,
      code,
      zone: zone.zone,
      level: str(b.level, { max: 40, field: 'Level' }) || zone.level,
      type,
      status: 'available',
      qrPlacardId: `QR-${letter}-${code.replace(/^P/, '')}`,
      occupiedBy: null,
      createdAt: nowIso()
    };
    db.slots.push(slot);
    log('success', 'Admin-Console', `Bay ${code} (${type}) commissioned in ${zone.zone}.`, req.user.name);
    commit();
    res.status(201).json(slotView(slot, req.user));
  });

  api.delete('/slots/:id', requireAdmin, (req, res) => {
    const slot = db.slots.find((s) => s.id === req.params.id);
    if (!slot) throw new HttpError(404, 'Bay not found.');
    if (slot.status === 'occupied') throw new HttpError(409, 'Release the vehicle before decommissioning this bay.');
    db.slots = db.slots.filter((s) => s.id !== slot.id);
    log('warning', 'Admin-Console', `Bay ${slot.code} decommissioned.`, req.user.name);
    commit();
    res.json({ success: true });
  });

  function zoneFields(b, { partial = false } = {}) {
    const out = {};
    if (!partial || b.name !== undefined) out.name = str(b.name, { min: 3, max: 70, field: 'Facility name' });
    if (!partial || b.address !== undefined) out.address = str(b.address, { max: 140, field: 'Address' });
    if (!partial || b.lat !== undefined) out.lat = num(b.lat, { min: -90, max: 90, field: 'Latitude' });
    if (!partial || b.lng !== undefined) out.lng = num(b.lng, { min: -180, max: 180, field: 'Longitude' });
    if (!partial || b.level !== undefined) out.level = str(b.level, { max: 40, field: 'Level' }) || 'Ground Level';
    if (!partial || b.securityLevel !== undefined) out.securityLevel = str(b.securityLevel, { max: 40, field: 'Security level' }) || 'Campus Patrol';
    if (!partial || b.isCovered !== undefined) out.isCovered = Boolean(b.isCovered);
    return out;
  }

  api.post('/zones', requireAdmin, (req, res) => {
    const b = req.body || {};
    const fields = zoneFields(b);
    const total = num(b.totalSlots, { min: 1, max: 40, int: true, field: 'Number of bays' });
    const ev = num(b.evSlots ?? 0, { min: 0, max: total, int: true, field: 'EV bays' });
    const acc = num(b.accessibleSlots ?? 0, { min: 0, max: total - ev, int: true, field: 'Accessible bays' });

    const used = new Set(db.zones.map((z) => z.zone.replace('Zone ', '').toUpperCase()));
    let letter = String(b.zone || '').replace(/zone/i, '').trim().toUpperCase();
    if (letter) {
      if (!/^[A-Z0-9]{1,3}$/.test(letter)) throw badRequest('Zone label must be 1-3 letters or digits, e.g. "F".');
      if (used.has(letter)) throw new HttpError(409, `Zone ${letter} already exists.`);
    } else {
      letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !used.has(l));
      if (!letter) throw badRequest('All zone letters are in use.');
    }

    const zone = { id: `zone-${letter.toLowerCase()}`, zone: `Zone ${letter}`, ...fields, createdAt: nowIso() };
    db.zones.push(zone);

    let next = db.slots.reduce((m, s) => Math.max(m, parseInt(s.code.replace(/\D/g, ''), 10) || 0), 0) + 1;
    for (let i = 0; i < total; i += 1, next += 1) {
      const n = String(next).padStart(3, '0');
      db.slots.push({
        id: `s-${n}`,
        code: `P${n}`,
        zone: zone.zone,
        level: zone.level,
        type: i < ev ? 'EV Charging' : i < ev + acc ? 'Accessible' : 'Standard',
        status: 'available',
        qrPlacardId: `QR-${letter}-${n}`,
        occupiedBy: null,
        createdAt: nowIso()
      });
    }
    log('success', 'Admin-Console', `New parking hub "${zone.name}" (${zone.zone}) commissioned with ${total} bays.`, req.user.name);
    commit();
    res.status(201).json(zoneView(zone));
  });

  api.patch('/zones/:zone', requireAdmin, (req, res) => {
    const zone = zoneOf(req.params.zone);
    if (!zone) throw new HttpError(404, 'Zone not found.');
    Object.assign(zone, zoneFields(req.body || {}, { partial: true }));
    log('info', 'Admin-Console', `Facility details for ${zone.zone} updated.`, req.user.name);
    commit();
    res.json(zoneView(zone));
  });

  // -------------------------------------------------------------------------
  // violations
  // -------------------------------------------------------------------------
  api.post('/violations', requireAuth, (req, res) => {
    const b = req.body || {};
    const user = req.user;
    if (!VIOLATION_CATEGORIES.includes(b.category)) throw badRequest('Choose a violation category.');
    const compact = String(b.vehicleNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (compact.length < 4) throw badRequest('Enter the offending vehicle plate.');
    const plate = normalizePlate(b.vehicleNumber) || compact.slice(0, 14);
    const zone = zoneOf(b.zone);
    if (!zone) throw badRequest('Choose the campus zone where the violation occurred.');
    const description = str(b.description, { min: 10, max: 500, field: 'Description' });
    const urgency = URGENCIES.includes(b.urgency) ? b.urgency : 'medium';
    const location = str(b.location, { max: 60, field: 'Location' }).toUpperCase();

    if (b.imageUrl && !/^\/uploads\/[a-f0-9]{16,}\.(jpg|png|webp)$/.test(b.imageUrl)) throw badRequest('Invalid evidence image reference.');

    const dup = db.violations.find(
      (v) => v.vehicleNumber === plate && v.category === b.category && ['pending', 'investigating'].includes(v.status) && Date.now() - new Date(v.timestamp).getTime() < 2 * HOUR
    );
    if (dup) throw new HttpError(409, `This vehicle was already reported for the same issue (case ${dup.id}). Campus Security is on it.`);

    const ts = nowIso();
    let id;
    do id = `VIO-${new Date().getFullYear()}-${crypto.randomInt(1000, 10000)}`;
    while (db.violations.some((v) => v.id === id));
    const violation = {
      id,
      category: b.category,
      vehicleNumber: plate,
      zone: zone.zone,
      location,
      description,
      imageUrl: b.imageUrl || null,
      urgency,
      status: 'pending',
      timestamp: ts,
      reporterId: user.id,
      reporterName: user.name,
      adminNotes: 'Awaiting review by a parking control officer.',
      updatedAt: ts,
      history: [{ status: 'pending', note: 'Report filed.', by: user.name, at: ts }]
    };
    db.violations.unshift(violation);
    log('warning', 'Citizen-Reporting', `Violation ${id} filed for ${plate} (${b.category}, ${zone.zone}).`, user.name);
    for (const admin of db.users.filter((u) => u.role === 'admin')) {
      notify(admin.id, {
        type: urgency === 'critical' || urgency === 'high' ? 'warning' : 'info',
        title: `New ${urgency}-priority violation report`,
        message: `${b.category} at ${zone.zone} — vehicle ${plate}.`,
        link: '/admin?tab=violations'
      });
    }
    commit();
    res.status(201).json(violation);
  });

  api.patch('/violations/:id/status', requireAdmin, (req, res) => {
    const v = db.violations.find((x) => x.id === req.params.id);
    if (!v) throw new HttpError(404, `Case ${req.params.id} not found.`);
    const status = req.body?.status;
    if (!VIOLATION_STATUSES.includes(status)) throw badRequest('Invalid status.');
    if (!VIOLATION_TRANSITIONS[v.status].includes(status)) {
      throw new HttpError(409, `A case that is "${STATUS_LABEL[v.status]}" cannot move to "${STATUS_LABEL[status]}".`);
    }
    const note = str(req.body?.note, { max: 300, field: 'Note' });
    const at = nowIso();
    v.status = status;
    v.adminNotes = note || STATUS_LABEL[status];
    v.updatedAt = at;
    v.history.push({ status, note: v.adminNotes, by: req.user.name, at });
    log('info', 'Enforcement', `Violation ${v.id} moved to "${STATUS_LABEL[status]}".`, req.user.name);

    notify(v.reporterId, {
      type: 'info',
      title: `Your report ${v.id} is now: ${STATUS_LABEL[status]}`,
      message: v.adminNotes,
      link: '/report-violation'
    });
    if (status === 'warning_issued') {
      const offender = db.users.find((u) => u.role === 'user' && u.vehicleNumber === v.vehicleNumber);
      if (offender && offender.id !== v.reporterId) {
        notify(offender.id, {
          type: 'warning',
          title: 'Parking violation notice',
          message: `A notice (${v.id}) was issued for your vehicle ${v.vehicleNumber}: ${v.category} at ${v.zone}.`,
          link: '/dashboard'
        });
      }
    }
    commit();
    res.json(v);
  });

  // -------------------------------------------------------------------------
  // evidence uploads
  // -------------------------------------------------------------------------
  api.post('/uploads', requireAuth, async (req, res) => {
    const dataUrl = String(req.body?.dataUrl || '');
    const m = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw badRequest('Upload a JPEG, PNG or WebP image.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > (remote ? 650 * 1024 : 4 * 1024 * 1024)) throw new HttpError(413, remote ? 'Image is too large (max 650 KB on the cloud deployment). Try a smaller photo.' : 'Image is too large (max 4 MB).');
    const magic = {
      jpeg: buf[0] === 0xff && buf[1] === 0xd8,
      png: buf.subarray(0, 4).toString('hex') === '89504e47',
      webp: buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP'
    };
    if (!magic[m[1]]) throw badRequest('File content does not match its image type.');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    if (remote) await store.putBlob(name, m[2]);
    else fs.writeFileSync(path.join(uploadsDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  });

  // -------------------------------------------------------------------------
  // notifications
  // -------------------------------------------------------------------------
  api.post('/notifications/read', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? new Set(req.body.ids) : null;
    for (const n of db.notifications) {
      if (n.userId === req.user.id && (!ids || ids.has(n.id))) n.read = true;
    }
    commit();
    res.json({ success: true });
  });

  // -------------------------------------------------------------------------
  // officer analytics & audit trail
  // -------------------------------------------------------------------------
  api.get('/admin/logs', requireAdmin, (req, res) => {
    const limit = Math.min(500, parseInt(req.query.limit, 10) || 150);
    res.json(db.logs.slice(0, limit));
  });

  api.get('/admin/analytics', requireAdmin, (req, res) => {
    const now = Date.now();
    const endOf = (s) => (s.endTime ? new Date(s.endTime).getTime() : now);

    const firstHour = Math.floor(now / HOUR) * HOUR - 23 * HOUR;
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const a = firstHour + i * HOUR;
      const b = a + HOUR;
      return {
        hour: new Date(a).toISOString(),
        occupied: db.sessions.filter((s) => new Date(s.startTime).getTime() < b && endOf(s) > a).length
      };
    });

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const daily = Array.from({ length: 7 }, (_, i) => {
      const a = midnight.getTime() - (6 - i) * DAY;
      const b = a + DAY;
      return {
        date: new Date(a).toISOString(),
        sessions: db.sessions.filter((s) => {
          const t = new Date(s.startTime).getTime();
          return t >= a && t < b;
        }).length
      };
    });

    const weekAgo = now - 7 * DAY;
    const recent = db.sessions.filter((s) => new Date(s.startTime).getTime() >= weekAgo);
    const completed = recent.filter((s) => s.status === 'completed');
    const avgDuration = completed.length ? Math.round(completed.reduce((a, s) => a + s.durationMin, 0) / completed.length) : 0;

    const byZone = db.zones.map((z) => {
      const v = zoneView(z);
      const zs = recent.filter((s) => s.zone === z.zone);
      return {
        zone: z.zone,
        name: z.name,
        totalSlots: v.totalSlots,
        occupied: db.slots.filter((s) => s.zone === z.zone && s.status === 'occupied').length,
        sessions7d: zs.length
      };
    });

    const byCategory = VIOLATION_CATEGORIES.map((c) => ({ category: c, count: db.violations.filter((v) => v.category === c).length }));
    const byStatus = VIOLATION_STATUSES.map((s) => ({ status: s, count: db.violations.filter((v) => v.status === s).length }));

    const reacted = db.violations.filter((v) => v.history.length > 1);
    const avgResponseMin = reacted.length
      ? Math.round(reacted.reduce((a, v) => a + (new Date(v.history[1].at) - new Date(v.timestamp)), 0) / reacted.length / MIN)
      : null;
    const closed = db.violations.filter((v) => v.status === 'resolved' || v.status === 'dismissed').length;
    const peak = hourly.reduce((best, h) => (h.occupied > best.occupied ? h : best), hourly[0]);

    res.json({
      generatedAt: nowIso(),
      hourly,
      daily,
      byZone,
      byCategory,
      byStatus,
      kpis: {
        sessions7d: recent.length,
        avgDurationMin: avgDuration,
        peakHour: peak.occupied > 0 ? peak.hour : null,
        peakOccupied: peak.occupied,
        avgResponseMin,
        closureRate: db.violations.length ? Math.round((closed / db.violations.length) * 100) : null,
        registeredDrivers: db.users.filter((u) => u.role === 'user').length
      }
    });
  });

  api.post('/admin/reset', requireAdmin, async (req, res) => {
    const mode = req.body?.mode === 'clean' ? 'clean' : 'demo';
    const fresh = await buildInitialData({ mode });
    const keepUsers = new Set(fresh.users.map((u) => u.id));
    fresh.tokens = db.tokens.filter((t) => keepUsers.has(t.userId));
    fresh.meta.rev = db.meta.rev;
    db = fresh;
    store.replace(db);
    log('warning', 'Admin-Console', `Database reset to "${mode}" dataset.`, req.user.name);
    commit();
    res.json({ success: true, mode });
  });

  api.use((req, res) => res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` }));

  // -------------------------------------------------------------------------
  // Serverless / shared-database mode. Each request: queue on this instance, load the latest data
  // from Redis, and (for writes) hold a cross-instance lock and persist BEFORE the response is sent.
  // -------------------------------------------------------------------------
  if (remote) {
    const mutex = new Mutex();
    app.use('/api/v1', async (req, res, next) => {
      const releaseLocal = await mutex.acquire();
      res.on('close', releaseLocal);
      let lockToken = null;
      try {
        // Uploads only write a blob, so they don't need the database lock.
        const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path !== '/uploads';
        if (mutating) lockToken = await store.lock();
        await store.refresh();
        db = store.data;
        if (mutating) {
          const origEnd = res.end.bind(res);
          let done = false;
          res.end = (...args) => {
            if (done) return res;
            done = true;
            (async () => {
              try {
                await store.persist();
              } catch (err) {
                console.error('[redis] persist failed:', err.message);
                store.invalidate();
                res.statusCode = 503;
                args = [JSON.stringify({ error: 'Could not save your change. Please try again.' })];
              } finally {
                await store.unlock(lockToken);
              }
              origEnd(...args);
            })();
            return res;
          };
        }
        next();
      } catch (err) {
        if (lockToken) await store.unlock(lockToken);
        next(err instanceof HttpError ? err : new HttpError(503, 'The data service is temporarily unavailable. Please try again.'));
      }
    });
  }

  app.use('/api/v1', api);
  app.get('/', (req, res, next) => (fs.existsSync(path.join(distDir, 'index.html')) ? next() : res.json({ service: 'ParkPulse API', status: 'ONLINE', docs: '/api/v1/health' })));

  // -------------------------------------------------------------------------
  // serve the built SPA (production / demo mode)
  // -------------------------------------------------------------------------
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir, { index: 'index.html', maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // -------------------------------------------------------------------------
  // error handling
  // -------------------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
    console.error('[api] Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return {
    app,
    store,
    close() {
      for (const res of sseClients) res.end();
      store.flush();
    }
  };
}
