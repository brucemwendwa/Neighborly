/**
 * Feature cards — one component per kind of thing the API returns.
 *
 * Each takes the API object as-is and knows how to display it, so the
 * shape of a booking is interpreted in exactly one place. A page decides
 * *which* cards to show and what actions to hang off them; the card
 * decides what a booking looks like.
 */
import { Link } from 'react-router-dom'
import { Avatar, StatusBadge, Stars } from './ui'
import { date, dateTime, label, money, relative } from '../utils/format'

export function ServiceCard({ service, onBook }) {
  return (
    <article className="card">
      <div className="row-between">
        <h3>{service.name}</h3>
        <span className="badge">{money(service.base_price)}</span>
      </div>
      {service.category && (
        <small className="muted">{service.category.name}</small>
      )}
      <p style={{ marginTop: '0.5rem' }}>{service.description}</p>
      <div className="row" style={{ marginTop: '0.9rem' }}>
        <Link to={`/services/${service.service_id}`} className="btn btn-ghost btn-sm">
          Details
        </Link>
        {onBook && (
          <button type="button" className="btn btn-sm" onClick={() => onBook(service)}>
            Book
          </button>
        )}
      </div>
    </article>
  )
}

export function ProviderCard({ provider, onPick, action }) {
  return (
    <article className="card">
      <div className="row">
        <Avatar user={provider.user} large />
        <div>
          <h3 style={{ marginBottom: '0.15rem' }}>{provider.user?.full_name}</h3>
          <Stars value={provider.rating} count={provider.review_count} />
        </div>
      </div>
      <p style={{ marginTop: '0.75rem' }}>{provider.bio || 'No bio yet.'}</p>
      <div className="row" style={{ marginTop: '0.9rem' }}>
        {provider.is_verified && <span className="badge badge-info">Verified</span>}
        {provider.is_approved ? (
          <span className="badge badge-success">Approved</span>
        ) : (
          <span className="badge badge-warn">Awaiting approval</span>
        )}
        <span className="badge">{provider.jobs_completed} jobs done</span>
      </div>
      {(onPick || action) && (
        <div className="row" style={{ marginTop: '0.9rem' }}>
          {onPick && (
            <button type="button" className="btn btn-sm" onClick={() => onPick(provider)}>
              Choose
            </button>
          )}
          {action}
        </div>
      )}
    </article>
  )
}

const BOOKING_STEPS = ['pending', 'accepted', 'in_progress', 'completed']

export function BookingCard({ booking, actions, viewAs = 'customer' }) {
  const other =
    viewAs === 'customer' ? booking.provider?.user : booking.customer
  return (
    <article className="card">
      <div className="row-between">
        <div>
          <h3 style={{ marginBottom: '0.2rem' }}>
            {booking.service?.name || 'Service'}
          </h3>
          <small className="muted">
            {label(booking.booking_type)} ·{' '}
            {booking.scheduled_date
              ? dateTime(booking.scheduled_date)
              : `booked ${relative(booking.created_at)}`}
          </small>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="row" style={{ marginTop: '0.85rem' }}>
        {other ? (
          <span className="user-chip">
            <Avatar user={other} />
            {other.full_name}
          </span>
        ) : (
          <span className="badge badge-warn">No provider yet</span>
        )}
        <span className="badge">{money(booking.total_amount)}</span>
        {booking.is_paid ? (
          <span className="badge badge-success">Paid</span>
        ) : (
          <span className="badge badge-warn">
            {money(booking.amount_paid)} of {money(booking.total_amount)}
          </span>
        )}
      </div>

      {booking.status !== 'cancelled' && (
        <div style={{ marginTop: '0.85rem' }}>
          <div className="timeline">
            {BOOKING_STEPS.map((step, i) => (
              <span
                key={step}
                className={`timeline-step ${
                  i <= BOOKING_STEPS.indexOf(booking.status) ? 'done' : ''
                }`}
              >
                {label(step)}
              </span>
            ))}
          </div>
        </div>
      )}

      {actions && (
        <div className="row" style={{ marginTop: '1rem' }}>
          {actions}
        </div>
      )}
    </article>
  )
}

export function ListingCard({ listing, children }) {
  return (
    <article className="card">
      {listing.images?.[0] ? (
        <img className="thumb" src={listing.images[0]} alt="" loading="lazy" />
      ) : (
        <div className="thumb" />
      )}
      <div className="row-between" style={{ marginTop: '0.8rem' }}>
        <h3 style={{ marginBottom: 0 }}>{listing.title}</h3>
        <StatusBadge status={listing.status} />
      </div>
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <span className="badge badge-success">{money(listing.rent_price)}/mo</span>
        <span className="badge">
          {listing.bedrooms} bed · {listing.bathrooms} bath
        </span>
        {listing.is_verified ? (
          <span className="badge badge-info">Verified</span>
        ) : (
          <span className="badge badge-warn">Unverified</span>
        )}
      </div>
      <p style={{ marginTop: '0.7rem' }} className="muted">
        {listing.estate?.estate_name} · listed {relative(listing.created_at)}
      </p>
      <div className="row" style={{ marginTop: '0.9rem' }}>
        <Link to={`/listings/${listing.listing_id}`} className="btn btn-ghost btn-sm">
          View
        </Link>
        {children}
      </div>
    </article>
  )
}

export function RideCard({ ride, children }) {
  return (
    <article className="card">
      <div className="row-between">
        <h3 style={{ marginBottom: 0 }}>
          {ride.from_location} → {ride.to_location}
        </h3>
        <StatusBadge status={ride.status} />
      </div>
      <p className="muted" style={{ marginTop: '0.35rem' }}>
        Leaves {dateTime(ride.departure_time)}
        {ride.return_time && ` · returns ${dateTime(ride.return_time)}`}
      </p>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        {ride.driver && (
          <span className="user-chip">
            <Avatar user={ride.driver} />
            {ride.driver.full_name}
          </span>
        )}
        <span className="badge badge-success">{money(ride.price_per_seat)}/seat</span>
        <span className={`badge ${ride.seats_left ? '' : 'badge-danger'}`}>
          {ride.seats_left} of {ride.available_seats} seats left
        </span>
        {ride.recurrence !== 'none' && (
          <span className="badge badge-info">{label(ride.recurrence)}</span>
        )}
      </div>
      {children && (
        <div className="row" style={{ marginTop: '0.9rem' }}>
          {children}
        </div>
      )}
    </article>
  )
}

export function MoveCard({ move, children }) {
  return (
    <article className="card">
      <div className="row-between">
        <h3 style={{ marginBottom: 0 }}>
          {move.pickup_location} → {move.dropoff_location}
        </h3>
        <StatusBadge status={move.status} />
      </div>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <span className="badge">{date(move.move_date)}</span>
        <span className="badge badge-info">{label(move.service_type)}</span>
        <span className="badge badge-success">{money(move.total_amount)}</span>
      </div>
      {children && (
        <div className="row" style={{ marginTop: '0.9rem' }}>
          {children}
        </div>
      )}
    </article>
  )
}

export function GatePassCard({ pass, children }) {
  return (
    <article className="card">
      <div className="row-between">
        <h3 style={{ marginBottom: 0 }}>{pass.visitor_name}</h3>
        <StatusBadge status={pass.status} />
      </div>
      <p className="muted" style={{ marginTop: '0.35rem' }}>
        {pass.purpose || 'Visit'} · {pass.visitor_phone}
      </p>
      <div className="qr" style={{ marginTop: '0.75rem' }}>
        <span className="qr-code">{pass.qr_code}</span>
        <small className="muted">Show this code at the gate</small>
      </div>
      <div className="row" style={{ marginTop: '0.75rem' }}>
        <span className="badge">Arrives {dateTime(pass.entry_date)}</span>
        {pass.exit_date && <span className="badge">Leaves {dateTime(pass.exit_date)}</span>}
      </div>
      {children && (
        <div className="row" style={{ marginTop: '0.9rem' }}>
          {children}
        </div>
      )}
    </article>
  )
}

export function ReviewItem({ review }) {
  return (
    <div className="list-item">
      <Avatar user={review.reviewer} />
      <div className="stack-sm" style={{ flex: 1 }}>
        <div className="row-between">
          <strong>{review.reviewer?.full_name}</strong>
          <small className="muted">{relative(review.created_at)}</small>
        </div>
        <Stars value={review.rating} />
        {review.comment && <p style={{ margin: 0 }}>{review.comment}</p>}
      </div>
    </div>
  )
}

export function NotificationItem({ note, onRead, onDelete }) {
  return (
    <div className={`list-item ${note.is_read ? '' : 'unread'}`}>
      <div className="stack-sm" style={{ flex: 1 }}>
        <div className="row-between">
          <strong>{note.title}</strong>
          <small className="muted">{relative(note.created_at)}</small>
        </div>
        <p style={{ margin: 0 }}>{note.message}</p>
        <div className="row">
          <span className="badge">{label(note.type)}</span>
          {!note.is_read && (
            <button type="button" className="btn-link" onClick={() => onRead(note)}>
              Mark read
            </button>
          )}
          <button type="button" className="btn-link" onClick={() => onDelete(note)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
