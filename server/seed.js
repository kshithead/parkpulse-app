import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './security.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@parkpulse.edu', password: 'Admin@123' },
  driver: { email: 'driver@parkpulse.edu', password: 'Driver@123' }
};

// ---------------------------------------------------------------------------
// Campus infrastructure: zones & bays (this is configuration, not "fake data")
// ---------------------------------------------------------------------------
const ZONE_SPECS = [
  {
    zone: 'Zone A',
    name: 'Main Entrance & Admin Block Lot',
    address: 'Main Gate, Kondhwa Main Rd, Pune 411048',
    lat: 18.4603133,
    lng: 73.8835838,
    level: 'Ground Floor',
    isCovered: false,
    securityLevel: 'Guarded Main Gate',
    bays: ['Standard', 'EV Charging', 'Accessible', 'Standard', 'Standard', 'Standard', 'Standard', 'Standard']
  },
  {
    zone: 'Zone B',
    name: 'Engineering & Innovation Hub',
    address: 'East Academic Corridor, Kondhwa Campus, Pune',
    lat: 18.46072,
    lng: 73.88395,
    level: 'Level 1 (Covered)',
    isCovered: true,
    securityLevel: 'Patrolled Deck',
    bays: ['Standard', 'EV Charging', 'Standard', 'Accessible', 'Standard', 'Standard']
  },
  {
    zone: 'Zone C',
    name: 'Central Library & Design Annex',
    address: 'Central Campus Quadrangle, Kondhwa, Pune',
    lat: 18.45995,
    lng: 73.8832,
    level: 'Basement B1',
    isCovered: true,
    securityLevel: 'CCTV Monitored',
    bays: ['EV Charging', 'Standard', 'Standard', 'Standard', 'Standard', 'Accessible']
  },
  {
    zone: 'Zone D',
    name: 'Sports Ground & Cafeteria Lot',
    address: 'Athletics Ground & Student Activity Centre, Pune',
    lat: 18.4596,
    lng: 73.8837,
    level: 'Open Surface Lot',
    isCovered: false,
    securityLevel: 'Campus Patrol',
    bays: ['Standard', 'Standard', 'EV Charging', 'Standard', 'Standard', 'Accessible', 'Standard', 'Standard']
  },
  {
    zone: 'Zone E',
    name: 'Management Studies & Hostel Lot',
    address: 'South Wing Residential & Hostel Gate, Kondhwa, Pune',
    lat: 18.4605,
    lng: 73.8841,
    level: 'Ground Level',
    isCovered: false,
    securityLevel: '24/7 Hostel Gate Booth',
    bays: ['Standard', 'Standard', 'Standard', 'Accessible', 'Standard', 'Standard']
  }
];

export function buildInfrastructure(now) {
  const zones = [];
  const slots = [];
  let counter = 1;
  for (const spec of ZONE_SPECS) {
    const letter = spec.zone.replace('Zone ', '');
    zones.push({
      id: `zone-${letter.toLowerCase()}`,
      zone: spec.zone,
      name: spec.name,
      address: spec.address,
      lat: spec.lat,
      lng: spec.lng,
      level: spec.level,
      isCovered: spec.isCovered,
      securityLevel: spec.securityLevel,
      createdAt: new Date(now - 90 * DAY).toISOString()
    });
    for (const type of spec.bays) {
      const n = String(counter).padStart(3, '0');
      slots.push({
        id: `s-${n}`,
        code: `P${n}`,
        zone: spec.zone,
        level: spec.level,
        type,
        status: 'available',
        qrPlacardId: `QR-${letter}-${n}`,
        occupiedBy: null,
        createdAt: new Date(now - 90 * DAY).toISOString()
      });
      counter += 1;
    }
  }
  return { zones, slots };
}

// ---------------------------------------------------------------------------
// Deterministic PRNG so demo data is reproducible
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DRIVERS = [
  { name: 'Aarav Deshmukh', plate: 'MH-12-KT-4471', model: 'Hyundai Creta' },
  { name: 'Ananya Iyer', plate: 'MH-14-GD-2208', model: 'Tata Nexon EV' },
  { name: 'Rohan Kulkarni', plate: 'MH-12-RT-9035', model: 'Honda City' },
  { name: 'Sneha Patil', plate: 'MH-12-PQ-1184', model: 'Maruti Swift' },
  { name: 'Karthik Nair', plate: 'KA-03-MJ-5520', model: 'Kia Seltos' },
  { name: 'Ishita Bhandari', plate: 'MH-14-HH-7761', model: 'Hyundai i20' },
  { name: 'Vihaan Joshi', plate: 'MH-12-ZX-3092', model: 'Mahindra XUV300' },
  { name: 'Meera Choudhary', plate: 'MH-12-LB-6413', model: 'Tata Punch' },
  { name: 'Arjun Menon', plate: 'KL-07-CF-8826', model: 'Toyota Glanza' },
  { name: 'Prachi Shinde', plate: 'MH-12-WE-2750', model: 'Maruti Baleno' },
  { name: 'Dev Malhotra', plate: 'DL-08-CA-1937', model: 'Skoda Slavia' },
  { name: 'Tanvi Gokhale', plate: 'MH-14-JK-4086', model: 'Honda Amaze' },
  { name: 'Siddharth Rao', plate: 'TS-09-EB-5578', model: 'MG Hector' },
  { name: 'Neha Pawar', plate: 'MH-12-QS-9914', model: 'Hyundai Venue' }
];

const STRANGER_PLATES = ['MH-12-DN-3305', 'MH-14-AB-6602', 'GJ-05-CR-1479', 'MH-12-XY-8051', 'KA-51-MD-7700', 'MH-09-FZ-2214'];

const VIOLATION_TEMPLATES = [
  { category: 'Reserved Space Infringement', urgency: 'high', text: 'Car parked in the accessible bay without any disability permit displayed on the dashboard.' },
  { category: 'Blocked Parking', urgency: 'critical', text: 'Vehicle stopped across the basement ramp, blocking the fire-lane and exit for other cars.' },
  { category: 'Wrong Parking', urgency: 'medium', text: 'Sedan parked diagonally across two marked bays, leaving no room for the adjacent vehicle to enter.' },
  { category: 'No QR Check-In', urgency: 'low', text: 'Vehicle has been standing in the bay for over an hour but the bay still shows as available in the app.' },
  { category: 'Unauthorized Parking', urgency: 'medium', text: 'Non-EV vehicle occupying the EV charging bay without plugging in.' },
  { category: 'Blocked Parking', urgency: 'high', text: 'Two-wheeler cluster blocking pedestrian access near the hostel gate.' },
  { category: 'Wrong Parking', urgency: 'low', text: 'Hatchback parked over the painted line, partially blocking the next bay.' },
  { category: 'Unauthorized Parking', urgency: 'high', text: 'External vehicle without campus sticker parked in the faculty-reserved row.' }
];

/**
 * Build a fresh database.
 * mode 'clean' -> infrastructure + officer account only
 * mode 'demo'  -> adds drivers plus a week of realistic activity relative to `now`
 */
export async function buildInitialData({ mode = 'demo', now = Date.now() } = {}) {
  const { zones, slots } = buildInfrastructure(now);
  const rand = mulberry32(20260517);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const iso = (t) => new Date(t).toISOString();

  const adminHash = await hashPassword(DEMO_ACCOUNTS.admin.password);
  const users = [
    {
      id: 'usr-admin-1',
      name: 'Rajesh Kulkarni',
      email: DEMO_ACCOUNTS.admin.email,
      passwordHash: adminHash,
      role: 'admin',
      phone: '+91 98220 41107',
      badgeId: 'PP-OFF-1042',
      department: 'Campus Security & Traffic Control',
      createdAt: iso(now - 90 * DAY)
    }
  ];

  const db = {
    meta: { schema: 1, seedMode: mode, createdAt: iso(now), rev: 1 },
    users,
    tokens: [],
    zones,
    slots,
    sessions: [],
    violations: [],
    notifications: [],
    logs: []
  };

  const addLog = (t, level, source, message, actor = 'System') =>
    db.logs.push({ id: `log_${db.logs.length + 1}`, at: iso(t), level, source, message, actor });

  addLog(now - 90 * DAY, 'success', 'System', `Campus network provisioned: ${zones.length} zones, ${slots.length} bays commissioned.`);

  if (mode !== 'demo') {
    db.logs.reverse();
    return db;
  }

  // ---- Drivers ----------------------------------------------------------
  const driverHash = await hashPassword(DEMO_ACCOUNTS.driver.password);
  DRIVERS.forEach((d, i) => {
    const slug = d.name.toLowerCase().replace(/[^a-z]+/g, '.');
    users.push({
      id: `usr-driver-${i + 1}`,
      name: d.name,
      email: i === 0 ? DEMO_ACCOUNTS.driver.email : `${slug}@students.parkpulse.edu`,
      passwordHash: driverHash,
      role: 'user',
      phone: `+91 9${String(Math.floor(100000000 + rand() * 899999999))}`.replace(/(\d{5})(\d{5})$/, '$1 $2'),
      vehicleNumber: d.plate,
      vehicleModel: d.model,
      createdAt: iso(now - (60 - i * 3) * DAY)
    });
  });
  const drivers = users.filter((u) => u.role === 'user');

  // ---- Historical sessions (last 7 days) ---------------------------------
  const slotBusy = new Map(slots.map((s) => [s.id, []]));
  const overlaps = (slotId, a, b) => slotBusy.get(slotId).some(([x, y]) => a < y && b > x);
  let sessionCounter = 1;
  const addSession = (slot, driver, start, end) => {
    slotBusy.get(slot.id).push([start, end ?? now + DAY]);
    const s = {
      sessionId: `sess_${String(sessionCounter++).padStart(4, '0')}`,
      userId: driver.id,
      slotId: slot.id,
      slotCode: slot.code,
      zone: slot.zone,
      vehicleNumber: driver.vehicleNumber,
      driverName: driver.name,
      startTime: iso(start),
      status: end ? 'completed' : 'active'
    };
    if (end) {
      s.endTime = iso(end);
      s.durationMin = Math.max(1, Math.ceil((end - start) / MIN));
      s.endedBy = 'driver';
    }
    db.sessions.push(s);
    return s;
  };

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Two arrival waves per day (morning + afternoon), weekday-weighted.
  const hourWeights = [
    [7.5, 1], [8, 4], [8.5, 7], [9, 8], [9.5, 6], [10, 5], [11, 3], [12, 3],
    [13, 4], [14, 5], [15, 4], [16, 3], [17, 2], [18, 1]
  ];
  const totalWeight = hourWeights.reduce((a, [, w]) => a + w, 0);
  const sampleHour = () => {
    let r = rand() * totalWeight;
    for (const [h, w] of hourWeights) {
      r -= w;
      if (r <= 0) return h + rand() * 0.5;
    }
    return 9;
  };

  for (let d = 7; d >= 0; d -= 1) {
    const dayStart = startOfToday.getTime() - d * DAY;
    const dow = new Date(dayStart).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const count = d === 0 ? 14 : isWeekend ? 6 + Math.floor(rand() * 4) : 24 + Math.floor(rand() * 10);
    for (let i = 0; i < count; i += 1) {
      const start = dayStart + sampleHour() * HOUR;
      const durMin = Math.round(25 + Math.pow(rand(), 1.6) * 260);
      const end = start + durMin * MIN;
      if (start > now - 20 * MIN || end > now - 5 * MIN) continue; // today's sessions must already have finished
      const driver = pick(drivers);
      let placed = false;
      for (let attempt = 0; attempt < 8 && !placed; attempt += 1) {
        const slot = pick(slots);
        if (!overlaps(slot.id, start, end) && !db.sessions.some((s) => s.userId === driver.id && new Date(s.startTime) < end && new Date(s.endTime || now + DAY) > start)) {
          addSession(slot, driver, start, end);
          placed = true;
        }
      }
    }
  }

  // ---- Currently active sessions -----------------------------------------
  const activeTarget = 7;
  const busyDrivers = new Set();
  let guard = 0;
  while (db.sessions.filter((s) => s.status === 'active').length < activeTarget && guard < 200) {
    guard += 1;
    const driver = pick(drivers.slice(1)); // keep the demo driver free so the presenter can check in live
    if (busyDrivers.has(driver.id)) continue;
    const slot = pick(slots);
    const start = now - Math.round(8 + rand() * 150) * MIN;
    if (overlaps(slot.id, start, now + DAY)) continue;
    const s = addSession(slot, driver, start, null);
    const target = slots.find((x) => x.id === slot.id);
    target.status = 'occupied';
    target.occupiedBy = {
      sessionId: s.sessionId,
      userId: driver.id,
      vehicleNumber: driver.vehicleNumber,
      driverName: driver.name,
      startTime: s.startTime
    };
    busyDrivers.add(driver.id);
  }

  // A bay under maintenance and one reserved for an official vehicle.
  const freeSlots = slots.filter((s) => s.status === 'available' && s.type === 'Standard');
  if (freeSlots.length > 3) {
    freeSlots[freeSlots.length - 1].status = 'maintenance';
    freeSlots[Math.floor(freeSlots.length / 2)].status = 'reserved';
  }
  db.sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  // ---- Violations ----------------------------------------------------------
  const statusPlan = ['pending', 'pending', 'investigating', 'warning_issued', 'warning_issued', 'resolved', 'resolved', 'dismissed'];
  VIOLATION_TEMPLATES.forEach((tpl, i) => {
    const reporter = pick(drivers);
    const ts = now - Math.round((25 + i * 310 + rand() * 120)) * MIN;
    const status = statusPlan[i];
    const zone = pick(zones).zone;
    const plate = i % 3 === 0 ? pick(STRANGER_PLATES) : pick(drivers.filter((d) => d.id !== reporter.id)).vehicleNumber;
    const history = [{ status: 'pending', note: 'Report filed by citizen.', by: reporter.name, at: iso(ts) }];
    const officer = users[0].name;
    const steps = { investigating: ['investigating'], warning_issued: ['investigating', 'warning_issued'], resolved: ['investigating', 'warning_issued', 'resolved'], dismissed: ['investigating', 'dismissed'] }[status] || [];
    const notes = {
      investigating: 'Patrol unit dispatched for on-site verification.',
      warning_issued: 'Verified on site. Official violation notice placed on the vehicle.',
      resolved: 'Vehicle relocated by the owner. Case closed.',
      dismissed: 'Owner produced a valid permit. Report dismissed as unfounded.'
    };
    steps.forEach((st, idx) => history.push({ status: st, note: notes[st], by: officer, at: iso(ts + (idx + 1) * 18 * MIN) }));
    const v = {
      id: `VIO-2026-${String(1000 + i * 37 + Math.floor(rand() * 30))}`,
      category: tpl.category,
      vehicleNumber: plate,
      zone,
      location: `Zone bay row ${1 + Math.floor(rand() * 3)}`,
      description: tpl.text,
      imageUrl: null,
      urgency: tpl.urgency,
      status,
      timestamp: iso(ts),
      reporterId: reporter.id,
      reporterName: reporter.name,
      adminNotes: history[history.length - 1].note,
      updatedAt: history[history.length - 1].at,
      history
    };
    db.violations.push(v);
  });
  db.violations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // ---- Audit log derived from the events above ---------------------------------
  const logEvents = [];
  for (const s of db.sessions) {
    const st = new Date(s.startTime).getTime();
    if (st < now - 3 * DAY) continue;
    logEvents.push([st, 'success', 'QR-CheckIn', `Vehicle ${s.vehicleNumber} checked into bay ${s.slotCode} (${s.zone}).`, s.driverName]);
    if (s.endTime) {
      logEvents.push([new Date(s.endTime).getTime(), 'info', 'Session-Manager', `Bay ${s.slotCode} released after ${s.durationMin} min by ${s.vehicleNumber}.`, s.driverName]);
    }
  }
  for (const v of db.violations) {
    for (const h of v.history) {
      const t = new Date(h.at).getTime();
      if (h.status === 'pending') {
        logEvents.push([t, 'warning', 'Citizen-Reporting', `Violation ${v.id} filed for ${v.vehicleNumber} (${v.category}).`, h.by]);
      } else {
        logEvents.push([t, 'info', 'Enforcement', `Violation ${v.id} moved to "${h.status.replace('_', ' ')}".`, h.by]);
      }
    }
  }
  logEvents.sort((a, b) => a[0] - b[0]).forEach(([t, level, source, message, actor]) => addLog(t, level, source, message, actor));
  db.logs = db.logs.slice(-300).reverse();

  // A couple of notifications so the bell is not empty for the demo driver.
  const demoDriver = drivers[0];
  db.notifications.push({
    id: 'ntf_seed_1',
    userId: demoDriver.id,
    type: 'info',
    title: 'Welcome to ParkPulse',
    message: 'Scan the QR placard on any bay to check in. Your session timer starts automatically.',
    link: '/qr-parking',
    read: false,
    createdAt: iso(now - 2 * HOUR)
  });

  return db;
}

// CLI: `node server/seed.js demo|clean` rewrites the database file.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] === 'clean' ? 'clean' : 'demo';
  const { Store } = await import('./store.js');
  const file = process.env.DB_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'db.json');
  const store = new Store(file);
  store.replace(await buildInitialData({ mode }));
  const d = store.data;
  console.log(`Seeded "${mode}" database at ${file}`);
  console.log(`  zones: ${d.zones.length}  bays: ${d.slots.length}  users: ${d.users.length}  sessions: ${d.sessions.length}  violations: ${d.violations.length}`);
  console.log(`  Officer login: ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`);
  if (mode === 'demo') console.log(`  Driver login:  ${DEMO_ACCOUNTS.driver.email} / ${DEMO_ACCOUNTS.driver.password}`);
}
