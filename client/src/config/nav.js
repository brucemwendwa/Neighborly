/**
 * Navigation for every workspace, in one table.
 *
 * The app is split into role workspaces rather than one flat menu: a guard on
 * the gate and a platform admin share no screens, so putting their links in the
 * same nav only forces both to read past the other's tools. Each workspace gets
 * its own shell, and `/commute`, `/security`, `/admin` namespace themselves so
 * two workspaces can never resolve the same path.
 *
 * `icon` names a lucide icon, resolved by <Icon /> — see components/Icon.jsx.
 *
 * This is presentation only. The server enforces the same rules on every
 * request, because anyone can edit localStorage and type a URL.
 */

// ── Resident: the default workspace, bottom nav on mobile ───────────────────
export const RESIDENT_NAV = [
  { label: 'Home', href: '/home', icon: 'Home' },
  { label: 'Services', href: '/services', icon: 'Sparkles' },
  { label: 'Find & Move', href: '/find-and-move', icon: 'Building2' },
  { label: 'Commute', href: '/commute', icon: 'Car' },
  { label: 'Wallet', href: '/wallet', icon: 'Wallet' },
  { label: 'Profile', href: '/profile', icon: 'User' },
]

// ── Commute: secondary tabs rendered inside the resident shell ──────────────
export const COMMUTE_SUBNAV = [
  { label: 'Overview', href: '/commute', icon: 'Home', end: true },
  { label: 'Find a ride', href: '/commute/find-ride', icon: 'Search' },
  { label: 'Offer', href: '/commute/offer-ride', icon: 'Car' },
  { label: 'Upcoming', href: '/commute/upcoming', icon: 'CalendarClock' },
]

// ── Provider: the working side of the marketplace ───────────────────────────
export const PROVIDER_NAV = [
  { label: 'Jobs', href: '/provider/jobs', icon: 'Briefcase' },
  { label: 'Requests', href: '/provider/requests', icon: 'ClipboardList' },
  { label: 'Earnings', href: '/wallet', icon: 'Wallet' },
  { label: 'Profile', href: '/provider/profile', icon: 'User' },
]

// ── Security: what a guard on the gate needs, and nothing else ──────────────
export const SECURITY_NAV = [
  { label: 'Scan', href: '/security/scan', icon: 'ScanLine' },
  { label: 'Expected', href: '/security/expected', icon: 'Clock' },
  { label: 'Entries', href: '/security/entries', icon: 'ClipboardList' },
  { label: 'Profile', href: '/security/profile', icon: 'User' },
]

// ── Platform admin: sidebar on desktop, scroll tabs on mobile ───────────────
export const PLATFORM_NAV = [
  { label: 'Global Overview', href: '/admin/overview', icon: 'LayoutDashboard' },
  { label: 'Estates', href: '/admin/estates', icon: 'Building2' },
  { label: 'Users', href: '/admin/users', icon: 'Users' },
  { label: 'Providers', href: '/admin/providers', icon: 'Briefcase' },
  { label: 'Listings', href: '/admin/listings', icon: 'Home' },
  { label: 'Services', href: '/admin/services', icon: 'Sparkles' },
]

/**
 * Which workspace a role lands in after signing in. A user who types a URL
 * outside their workspace still hits <ProtectedRoute>, which is what actually
 * turns them away — this only decides where "home" is.
 */
export const ROLE_HOME = {
  resident: '/home',
  provider: '/provider/requests',
  security: '/security/scan',
  admin: '/admin/overview',
}

export const ROLE_LABELS = {
  resident: 'Resident',
  provider: 'Service provider',
  security: 'Security guard',
  admin: 'Platform admin',
}
