import { lazy } from 'react';

// Route-level code splitting. Each loader is also exposed for hover/focus prefetching
// so navigation feels instant by the time the user actually clicks.
const loaders = {
  dashboard: () => import('./UserDashboard').then((m) => ({ default: m.UserDashboard })),
  qr: () => import('./QRParkingPage').then((m) => ({ default: m.QRParkingPage })),
  nearby: () => import('./NearbyParkingPage').then((m) => ({ default: m.NearbyParkingPage })),
  report: () => import('./ViolationReportPage').then((m) => ({ default: m.ViolationReportPage })),
  admin: () => import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
  placards: () => import('./PlacardsPage').then((m) => ({ default: m.PlacardsPage }))
};

export const pages = Object.fromEntries(Object.entries(loaders).map(([key, load]) => [key, lazy(load)]));

const byPath = {
  '/dashboard': loaders.dashboard,
  '/qr-parking': loaders.qr,
  '/nearby': loaders.nearby,
  '/report-violation': loaders.report,
  '/admin': loaders.admin,
  '/admin/placards': loaders.placards
};

export const preloadRoute = (path) => {
  byPath[path]?.();
};

/** Page titles for the top bar and document.title. */
export const ROUTE_META = {
  '/dashboard': { title: 'Dashboard' },
  '/qr-parking': { title: 'Scan & Park' },
  '/nearby': { title: 'Campus Map' },
  '/report-violation': { title: 'Violation Reports' },
  '/admin': { title: 'Operations Center' },
  '/admin/placards': { title: 'QR Placards' }
};
