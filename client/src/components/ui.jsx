/**
 * The small building blocks every page shares.
 *
 * They live in one file on purpose: each is a handful of lines, and having
 * them together makes the vocabulary of the UI easy to read in one sitting.
 * Anything with real behaviour (Layout, ProtectedRoute, the feature cards)
 * gets its own file.
 */
import { initials, label } from '../utils/format'

/** A page title with optional description and right-hand actions. */
export function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div className="row-between">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="row">{children}</div>}
      </div>
    </header>
  )
}

/**
 * Status pill. The colour is chosen from the status name, so booking,
 * payment, listing and ride statuses all read consistently without each
 * page inventing its own mapping.
 */
const TONES = {
  success: ['completed', 'success', 'accepted', 'active', 'vacant', 'booked', 'verified'],
  warn: ['pending', 'in_progress', 'assigned', 'used', 'occupied'],
  danger: ['cancelled', 'failed', 'expired', 'refunded'],
}

export function StatusBadge({ status, children }) {
  const value = String(status || '').toLowerCase()
  const tone =
    Object.entries(TONES).find(([, values]) => values.includes(value))?.[0] || 'info'
  return <span className={`badge badge-${tone}`}>{children || label(status)}</span>
}

/** Read-only star row: <Stars value={4.5} />. */
export function Stars({ value, count }) {
  const filled = Math.round(value || 0)
  return (
    <span className="row" style={{ gap: '0.4rem' }}>
      <span className="stars" aria-label={`${value || 0} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= filled ? '' : 'off'}>
            ★
          </span>
        ))}
      </span>
      {value ? <small className="muted">{value}</small> : <small className="muted">No reviews</small>}
      {count ? <small className="muted">({count})</small> : null}
    </span>
  )
}

/** Clickable star row for the review form. */
export function StarPicker({ value, onChange }) {
  return (
    <div className="row" style={{ gap: 0 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-button ${n <= value ? 'on' : ''}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/** Initials circle, or the profile picture when there is one. */
export function Avatar({ user, large }) {
  const cls = `avatar${large ? ' avatar-lg' : ''}`
  if (user?.profile_picture) {
    return (
      <span className={cls}>
        <img src={user.profile_picture} alt="" />
      </span>
    )
  }
  return <span className={cls}>{initials(user?.full_name || '?')}</span>
}

/** Labelled input. Pass `as="select"` or `as="textarea"` to swap the tag. */
export function Field({ label: text, hint, as = 'input', children, ...props }) {
  const Tag = as
  return (
    <label className="field">
      <span>{text}</span>
      {as === 'select' ? <select {...props}>{children}</select> : <Tag {...props} />}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

/** The three states every fetched list can be in, handled once. */
export function Loading({ rows = 3 }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="notice">
      {error}
      {onRetry && (
        <>
          {' '}
          <button type="button" className="btn-link" onClick={onRetry}>
            Try again
          </button>
        </>
      )}
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

/**
 * Renders the right thing for {loading, error, empty, data}.
 * Saves the same six-line conditional on every list screen.
 */
export function Results({ loading, error, onRetry, items, empty, children }) {
  if (loading) return <Loading />
  if (error) return <ErrorNote error={error} onRetry={onRetry} />
  if (!items?.length) return empty || <Empty title="Nothing here yet" />
  return children
}

/** A stat tile for the dashboards. */
export function Stat({ value, label: text }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{text}</div>
    </div>
  )
}

/** Simple, focus-trapping-free modal — enough for a form or a confirm. */
export function Modal({ title, onClose, children, footer }) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
        {footer && <div className="row" style={{ marginTop: '1.25rem' }}>{footer}</div>}
      </div>
    </div>
  )
}

/** Page N of M, with prev/next. Works with the API's list envelope. */
export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null
  return (
    <nav className="pagination">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}

/** The status track shown on a booking, so progress is visible at a glance. */
export function Timeline({ steps, current }) {
  const index = steps.indexOf(current)
  return (
    <div className="timeline">
      {steps.map((step, i) => (
        <span key={step} className={`timeline-step ${i <= index ? 'done' : ''}`}>
          {label(step)}
        </span>
      ))}
    </div>
  )
}
