# ParkPulse – Cloud-Based Smart Parking & Violation Reporting

A campus parking platform with **QR check-in/out, live availability, a real-time officer console and community violation reporting**. React + Vite frontend, Node/Express backend with a persistent database, live updates over Server-Sent Events.

No payments, no fines, no IoT sensors – bays are claimed by scanning a QR placard, and enforcement is by warnings and towing.

## Quick start

```bash
npm install
npm run dev          # API on :5000 + web app on :5173 (opens with demo data)
```

Open **http://localhost:5173**.

| Role | Email | Password |
|------|-------|----------|
| Driver | `driver@parkpulse.edu` | `Driver@123` |
| Security officer | `admin@parkpulse.edu` | `Admin@123` |

On the login page, the **"Fill demo credentials"** button fills these in (only shown while the server runs the demo dataset).

### Single-process / presentation mode

```bash
npm run demo         # builds the app, then serves UI + API together on http://localhost:5000
```

### Before you present

The demo dataset is generated *relative to the moment it is created* (active sessions started "40 min ago", a week of history, …). If the database is more than a day old, refresh it:

```bash
npm run seed:demo    # or in the app: Operations Center → Reset data → Reload demo dataset
npm run seed:clean   # empty campus: bays + officer account only
```

## Guided tour for new users

First-time users get an interactive walkthrough automatically after signing in: a spotlight highlights the real interface (stats, live bay board, scanner, map, report form — or the officer KPIs, tabs and placards), moves between pages and opens the mobile menu when needed. Drivers and officers get different tours. It never interrupts a QR-placard deep link.

- Replay any time with the **?** button in the top bar.
- Keyboard: ← / → to move, **Esc** to close.
- Completion is remembered per user in the browser (`parkpulse_tour_v1_<userId>` in localStorage). Clear it to see the tour again on first login.
- Steps live in `src/tour/steps.js`; targets are `data-tour="…"` attributes in the UI.

## Suggested demo script (≈5 minutes)

1. Open two browser windows side by side: **driver** (left) and **officer** (right, `/login?portal=admin`).
2. Driver → **Dashboard**: live bay grid, usage stats. Tap a green bay → **Start parking**. The timer starts.
3. Officer console updates **instantly, without refresh** (active sessions, occupancy, live feed).
4. Officer → **QR Placards**: show the real printable QR for a bay. Driver → **Scan & Park** → camera scans it (or open the link from a phone).
5. Driver → **Report Violation**: pick a category, enter a plate, attach a photo, submit.
6. Officer → **Violations**: *Verify on site* → *Issue notice*. The reporter (and the vehicle's owner, if registered) get notifications in the bell.
7. Officer → **Overview**: occupancy by hour, check-ins per day, zone utilisation, case response time. **Audit trail** shows every action. **Sessions** → export CSV.
8. Driver → **End parking**: receipt with real duration; the bay is free for everyone again.

## Responsive design

Layouts are tested at 360 px (phones), 768 px (tablets) and 1280 px+ (desktop): a slide-in menu on small screens, a fixed sidebar from 1024 px, 2-column stat grids on phones, card views instead of wide tables, 40 px+ touch targets on touch devices, 16 px inputs (no iOS zoom) and safe-area padding for notches.

## What's real

- **Single source of truth** – the Express API owns all state (`server/data/db.json`, written atomically). Two devices always see the same thing.
- **Authentication** – scrypt-hashed passwords, opaque bearer tokens (stored hashed, 7-day expiry), role-based access (driver / officer), login throttling.
- **Rules enforced server-side** – a bay can't be double-booked, a driver/vehicle can't have two active sessions, officers can't be checked in, violations follow a state machine (`pending → investigating → warning_issued → resolved/dismissed`), duplicate reports are detected, plates are validated and normalised (`KA-03-HA-8820`).
- **Real QR** – bay placards are generated as QR codes encoding `/qr-parking?code=P007`; the in-app scanner decodes them from the camera (jsQR). Scanning with a phone's own camera app also works (deep links survive the login redirect).
- **Real map** – Leaflet/OpenStreetMap with live per-zone availability, driver GPS position, haversine distances and walking/driving time estimates.
- **Evidence photos** – compressed in the browser, validated and stored by the server (`server/data/uploads`).
- **Live updates** – Server-Sent Events push a change signal; clients refetch. A 20 s poll and focus-refetch are the safety net. The sidebar shows real connection state and measured latency.
- **Analytics** – computed from actual session and violation records.
- **Privacy** – drivers never see other drivers' names or plates; reporters see only their own reports.

## Project structure

```
server/
  server.js      entry (listens, serves built UI in production)
  app.js         all REST routes, auth, validation, SSE, analytics
  store.js       atomic JSON-file persistence
  seed.js        campus layout + demo dataset generator (CLI: npm run seed:demo)
  security.js    password hashing / tokens      validators.js   input rules
src/
  context/       Auth, Parking (live state + SSE), Toast
  services/api.js    typed-ish API client (no mock fallback)
  pages/         Landing, Login, Register, Dashboard, QR, Map, Violations, Admin, Placards
  components/    common/ parking/ violations/ admin/
```

## API overview (`/api/v1`)

| Area | Endpoints |
|------|-----------|
| Public | `GET /health`, `GET /public/overview` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me` |
| State | `GET /state` (role-aware snapshot), `GET /slots/qr/:code` |
| Sessions | `POST /sessions/start`, `POST /sessions/end` |
| Violations | `POST /violations`, `PATCH /violations/:id/status` *(officer)*, `POST /uploads` |
| Infrastructure *(officer)* | `POST/PATCH/DELETE /slots`, `POST/PATCH /zones` |
| Officer | `GET /admin/analytics`, `GET /admin/logs`, `POST /admin/reset` |
| Realtime | `POST /events/ticket` → `GET /events?ticket=` (SSE) |

## Configuration

See `.env.example`. Everything has a default; common ones: `PORT`, `SEED_MODE` (`demo`/`clean`), `DB_FILE`.

## Notes & limits

- **Camera access needs HTTPS or `localhost`.** On a phone over plain `http://192.168.x.x` the camera is blocked by the browser – use manual bay-code entry, an HTTPS tunnel, or open placard links with the phone's camera app.
- Map tiles load from OpenStreetMap (needs internet); markers and distances work offline.
- Storage is a single-process JSON file – ideal for a campus pilot/demo. For multi-server deployment, swap `server/store.js` for PostgreSQL/MongoDB.
- Vercel (`api/index.js`) runs the same API on an ephemeral filesystem – data resets between cold starts, so use a persistent Node host for real use.
