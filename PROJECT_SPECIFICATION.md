# ParkPulse – Technical & Architectural Specification
## Cloud-Based Smart Parking Availability & Violation Reporting System

> **Audience:** project evaluators, viva committee, report writers
> **Category:** College minor project (S5 CSE) · **Version:** 3.0 – client/server architecture with a live backend

---

## 1. Problem & Solution

**Problem.** Campuses suffer from (1) blind parking hunting, (2) erratic or unauthorised parking that blocks fire lanes and reserved bays, (3) no low-cost way to know which bays are really free, and (4) no channel for the community to report violations with evidence.

**Solution.** A software-only platform:
- every bay carries a **QR placard**; scanning it claims the bay (`available → occupied`) and starts a timed session;
- drivers end the session from their phone, which releases the bay and stores the duration;
- everyone sees **live availability**; security gets a **real-time operations console**;
- the community files **violation reports with photo evidence**, which officers verify and adjudicate. Reporters (and the vehicle's registered owner) are notified at each step.

No payment gateway or fines (campus parking is free) and no IoT sensors (cost, maintenance, failure modes) – enforcement is warnings and towing.

## 2. Core workflows

### 2.1 QR check-in / check-out
1. Driver scans the bay placard (in-app camera scanner, or the phone camera → deep link `/qr-parking?code=P007`).
2. `POST /sessions/start` – the server atomically verifies the bay is `available`, the driver has no other active session, and the vehicle isn't already parked; then sets `occupied`, records plate + start time.
3. All connected clients receive an SSE `change` event and refetch; the officer console updates within a second.
4. `POST /sessions/end` – duration = `max(1, ceil((now − start) / 60 000))` minutes; bay returns to `available`; a completed session record is kept.

### 2.2 Violation lifecycle
```
pending ──► investigating ──► warning_issued ──► resolved
   └──────────────┴──────────────────┴──────────► dismissed
```
Transitions are validated server-side. Every change appends to the case's **history** (who, when, note), writes an **audit-log** entry and sends **notifications** (reporter; and the registered owner when a notice is issued).

## 3. Technology

| Layer | Technology |
|---|---|
| UI | React 19, React Router 7 (lazy routes), Tailwind CSS 3, Lucide icons |
| Maps / QR | Leaflet + OpenStreetMap, `qrcode` (generate), `jsqr` (decode camera frames) |
| Build | Vite 8 (dev proxy to the API) |
| API | Node 22, Express 5 |
| Persistence | Atomic JSON-file document store (`server/store.js`) – swappable for SQL/NoSQL |
| Realtime | Server-Sent Events (one-time ticket auth) + polling safety net |
| Security | scrypt password hashing, hashed bearer tokens, RBAC, login throttling, input validation, upload magic-byte checks |

## 4. Data model (collections in `db.json`)

- **users** `{ id, name, email, passwordHash, role: user|admin, phone, vehicleNumber, vehicleModel, badgeId?, department?, createdAt }`
- **zones** `{ id, zone, name, address, lat, lng, level, isCovered, securityLevel }` – counts (total/available/EV/accessible) are derived live
- **slots** `{ id, code, zone, level, type: Standard|EV Charging|Accessible, status: available|occupied|reserved|maintenance, qrPlacardId, occupiedBy }`
- **sessions** `{ sessionId, userId, slotId, slotCode, zone, vehicleNumber, driverName, startTime, endTime?, durationMin?, status, endedBy? }`
- **violations** `{ id, category, vehicleNumber, zone, location, description, imageUrl, urgency, status, timestamp, reporterId, adminNotes, history[] }`
- **notifications**, **logs** (audit trail), **tokens** (hashed)

## 5. Architecture

```
Browser (React)  ──REST/JSON──►  Express API  ──►  JSON store (server/data/db.json) + /uploads
      ▲                              │
      └────── SSE "change" events ───┘
```
- `server/app.js` – routes, auth middleware, validation, analytics, SSE.
- `src/context/ParkingContext.jsx` – holds the role-aware snapshot from `GET /state`, resubscribes on login, exposes actions that call the API and resync.
- Drivers receive only their own sessions/reports and masked bay occupancy; officers receive everything.

## 6. Officer analytics (computed from real records)
Hourly bay load (24 h), check-ins per day (7 d), zone utilisation, violations by category, average stay, peak hour, average first-response time, case-closure rate; plus an audit trail and CSV export of sessions.

## 7. Viva guide

**Why no payments/fines?** Campus parking is a free infrastructure service; payment gateways add merchant, legal and dispute overhead. Compliance is enforced with notices and towing.

**Why QR instead of IoT sensors?** Zero per-bay hardware, no batteries or wiring, works on any smartphone, scales by printing placards. Detecting vehicles that skip the scan is handled by community/guard reports (category *No QR Check-In*) and visual checks against the live board.

**How is a bay prevented from being double-booked?** Node handles each request synchronously on a single in-memory dataset; the availability check and the state change happen in the same tick, so two simultaneous check-ins cannot both succeed. (With a SQL database this becomes a transaction / conditional update.)

**How do two devices stay in sync?** The server is the only source of truth. After any mutation it broadcasts an SSE `change` event; clients refetch their role-specific snapshot. Polling and refetch-on-focus cover dropped connections.

**How is data protected?** Passwords are scrypt-hashed with per-user salts; session tokens are random and only their SHA-256 is stored; every route checks role; drivers can't see other drivers' identities; uploads are type- and signature-checked and served under random names.

**How would you scale it?** Replace the JSON store with PostgreSQL (the `Store` boundary is small), run several API instances behind a load balancer with Redis pub/sub for SSE fan-out, and move uploads to S3.
