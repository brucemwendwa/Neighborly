import {
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Car,
  ChevronDown,
  ClipboardList,
  Clock,
  Home,
  LayoutDashboard,
  ScanLine,
  Search,
  Sparkles,
  Truck,
  User,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Name-to-component lookup, so navigation tables can stay plain data.
 *
 * The alternative — importing the icon component into the nav config — would
 * make config/nav.js a module that has to be loaded by React, and the whole
 * point of that file is that it reads as a table.
 *
 * Only the icons actually referenced are imported, which is what keeps the
 * bundle from pulling in all thousand-odd lucide glyphs.
 */
const ICONS = {
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Car,
  ChevronDown,
  ClipboardList,
  Clock,
  Home,
  LayoutDashboard,
  ScanLine,
  Search,
  Sparkles,
  Truck,
  User,
  Users,
  Wallet,
}

export default function Icon({ name, size = 20, ...props }) {
  const Glyph = ICONS[name]
  // An unknown name is a typo in the nav table, not a runtime condition worth
  // crashing the whole shell over — render nothing and let it show up in review.
  if (!Glyph) return null
  return <Glyph size={size} strokeWidth={2} aria-hidden="true" {...props} />
}
