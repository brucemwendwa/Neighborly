/**
 * Display helpers.
 *
 * The API sends money as a string ("1500.00") and timestamps as ISO 8601.
 * Every screen formats them the same way, so the rules live here rather
 * than being re-typed in fifteen components.
 */

/** "1500.00" -> "KES 1,500" */
export function money(value, { withCurrency = true } = {}) {
  const number = Number(value ?? 0)
  const formatted = number.toLocaleString('en-KE', {
    minimumFractionDigits: number % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return withCurrency ? `KES ${formatted}` : formatted
}

/** "2026-08-05T10:00:00+00:00" -> "5 Aug 2026" */
export function date(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "…T10:00:00" -> "5 Aug 2026, 10:00" */
export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "…" -> "2 hours ago" / "in 3 days" */
export function relative(value) {
  if (!value) return ''
  const diff = new Date(value).getTime() - Date.now()
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return 'just now'
}

/** "in_progress" -> "In progress" */
export function label(value) {
  if (!value) return ''
  const text = String(value).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "Amina Hassan" -> "AH", for the avatar circle. */
export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

/**
 * Turn a <input type="datetime-local"> value into something the API's
 * DateTime field accepts. The browser gives "2026-08-05T10:00" with no
 * seconds, which marshmallow parses fine — this just guards against an
 * empty string being sent as "".
 */
export function toApiDate(value) {
  return value ? new Date(value).toISOString() : null
}
