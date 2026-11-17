// Guided tour content. `target` is a CSS selector (we tag real UI with data-tour attributes);
// a step without a target is shown as a centred card. `route` navigates before the step is shown,
// `sidebar` opens the mobile drawer so menu items are visible on phones.

export const DRIVER_STEPS = [
  {
    id: 'welcome',
    route: '/dashboard',
    title: 'Welcome to ParkPulse',
    body: 'Find a free bay, check in with a QR scan, and report problems on campus. This 1-minute tour shows you around — you can skip it now and replay it any time from the ? button at the top.'
  },
  {
    id: 'stats',
    route: '/dashboard',
    target: '[data-tour="stats"]',
    placement: 'bottom',
    title: 'Live campus numbers',
    body: 'Free bays, campus occupancy and your own parking time this week. These update by themselves the moment anyone checks in or out — no refreshing needed.'
  },
  {
    id: 'grid',
    route: '/dashboard',
    target: '[data-tour="slot-grid"]',
    placement: 'top',
    title: 'The live bay board',
    body: 'Green bays are free. Tap one to check in, or filter by zone and EV charging. Your own bay is marked “YOURS”, and while you are parked a timer appears at the top of this page.'
  },
  {
    id: 'nav',
    route: '/dashboard',
    target: '[data-tour="nav"]',
    sidebar: true,
    placement: 'right',
    title: 'Your menu',
    body: 'Dashboard, Scan & Park, the Campus Map and Report Violation. A “Parked” badge shows up here while a session is running.'
  },
  {
    id: 'scanner',
    route: '/qr-parking',
    target: '[data-tour="scanner"]',
    placement: 'right',
    title: 'Scan the QR placard',
    body: 'Every bay has a QR placard on its pillar. Start the camera and point it at the code — the bay is recognised instantly. Your phone’s own camera app works too.'
  },
  {
    id: 'lookup',
    route: '/qr-parking',
    target: '[data-tour="bay-lookup"]',
    placement: 'left',
    title: 'No camera? Type the code',
    body: 'Enter the bay code printed on the placard (for example P007) or tap one of the open bays. You will see the bay details and a Check-in button. Tap “End parking” when you leave.'
  },
  {
    id: 'map',
    route: '/nearby',
    target: '[data-tour="map"]',
    placement: 'bottom',
    title: 'Find the closest free zone',
    body: 'Pins show free bays per zone — green means plenty, amber means few, red means full. Tap “Use my location” to sort zones by distance and see walking and driving times.'
  },
  {
    id: 'report',
    route: '/report-violation',
    target: '[data-tour="report-form"]',
    placement: 'top',
    title: 'Report a violation',
    body: 'Blocked exit or misused bay? Choose a category, enter the plate and attach a photo. Campus security is alerted immediately, and you can follow the case under “My reports”.'
  },
  {
    id: 'bell',
    route: '/report-violation',
    target: '[data-tour="bell"]',
    placement: 'bottom',
    title: 'Notifications',
    body: 'You will be notified here when an officer acts on your report, or if a notice is ever issued for your vehicle.'
  },
  {
    id: 'help',
    route: '/dashboard',
    target: '[data-tour="help"]',
    placement: 'bottom',
    title: 'You’re all set',
    body: 'Tap the ? button whenever you want to replay this tour. Happy parking!'
  }
];

export const ADMIN_STEPS = [
  {
    id: 'welcome',
    route: '/admin',
    title: 'Welcome to the Operations Center',
    body: 'Monitor campus parking in real time, manage bays, adjudicate violation reports and review usage. This short tour covers the essentials — replay it any time from the ? button.'
  },
  {
    id: 'stats',
    route: '/admin',
    target: '[data-tour="stats"]',
    placement: 'bottom',
    title: 'Live KPIs',
    body: 'Capacity, occupancy, active sessions and open violations. Everything here is computed live from the server — tap “Active sessions” or “Open violations” to jump straight to them.'
  },
  {
    id: 'tabs',
    route: '/admin',
    target: '[data-tour="admin-tabs"]',
    placement: 'bottom',
    title: 'Six workspaces',
    body: 'Overview (charts and live activity), Bays (override status, print placards), Zones, Sessions (release bays, export CSV), Violations and the Audit trail. Each tab has its own URL, so you can bookmark it.'
  },
  {
    id: 'actions',
    route: '/admin',
    target: '[data-tour="admin-actions"]',
    placement: 'bottom',
    title: 'Add infrastructure',
    body: 'Create a new parking hub with GPS coordinates (its bays and QR identifiers are generated automatically) or add a single bay. “Reset data” reloads the demo dataset or clears the campus.'
  },
  {
    id: 'violations',
    route: '/admin?tab=violations',
    target: '[data-tour="admin-content"]',
    placement: 'top',
    title: 'Adjudicate violations',
    body: 'Verify on site, issue a notice, then resolve or dismiss. Each decision is logged, and the reporter — and the vehicle’s registered owner when a notice is issued — are notified automatically.'
  },
  {
    id: 'nav',
    route: '/admin',
    target: '[data-tour="nav"]',
    sidebar: true,
    placement: 'right',
    title: 'Menu',
    body: 'Campus Map shows live availability per zone, QR Placards prints a placard for every bay, and Patrol Reports lets you file violations you spot yourself.'
  },
  {
    id: 'placards',
    route: '/admin/placards',
    target: '[data-tour="placards"]',
    placement: 'top',
    title: 'Printable QR placards',
    body: 'Print one for every pillar. Each code opens that bay’s check-in page, so drivers can use the in-app scanner or any phone camera.'
  },
  {
    id: 'bell',
    route: '/admin/placards',
    target: '[data-tour="bell"]',
    placement: 'bottom',
    title: 'Alerts',
    body: 'New violation reports appear here the moment a driver files them.'
  },
  {
    id: 'help',
    route: '/admin',
    target: '[data-tour="help"]',
    placement: 'bottom',
    title: 'That’s the tour',
    body: 'Tap the ? button any time to replay it.'
  }
];
