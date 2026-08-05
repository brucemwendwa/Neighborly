import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboard } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, Stat, StatusBadge } from '../components/ui'
import { BookingCard, RideCard } from '../components/cards'
import { money, relative } from '../utils/format'

/**
 * Resident home — the first surface inside the resident workspace.
 *
 * GET /api/dashboard answers with every count the tiles need in a single
 * request, rather than the client firing eight list calls and counting the
 * results.
 */
export default function Dashboard() {
  const { user, isProvider } = useAuth()
  const { data, loading, error } = useApi(() => dashboard.get(), [])

  const summary = data?.summary
  const firstName = user.full_name.split(' ')[0]

  return (
    <>
      <header className="page-header">
        <div className="row-between">
          <div>
            <h1>Habari, {firstName}</h1>
            <p>
              {user.estate?.estate_name
                ? `Your estate: ${user.estate.estate_name}`
                : 'Set your estate on your profile to unlock bookings and rides.'}
            </p>
          </div>
          <div className="row">
            <Link to="/services" className="btn">
              Book a service
            </Link>
            <Link to="/gate-passes" className="btn btn-ghost">
              Issue gate pass
            </Link>
          </div>
        </div>
      </header>

      {error && <div className="notice">{error}</div>}
      {loading && <Loading rows={2} />}

      {summary && (
        <>
          <section className="stats">
            <Stat value={summary.active_bookings} label="Active bookings" />
            <Stat value={money(summary.wallet_balance)} label="Wallet balance" />
            <Stat value={summary.unread_notifications} label="Unread alerts" />
            <Stat value={summary.active_gate_passes} label="Active gate passes" />
            <Stat value={summary.my_listings} label="My listings" />
            <Stat value={summary.seats_claimed} label="Seats claimed" />
            {isProvider && (
              <>
                <Stat value={summary.jobs_pending} label="Jobs in progress" />
                <Stat value={money(summary.total_earned)} label="Earned" />
              </>
            )}
          </section>

          {isProvider && !summary.is_approved && (
            <div className="notice notice-info" style={{ marginTop: '1.25rem' }}>
              Your provider profile is waiting for an administrator to approve it.
              You can still book services in the meantime.
            </div>
          )}

          <div className="split section">
            <section>
              <div className="section-head">
                <h2>Recent bookings</h2>
                <Link to="/bookings" className="btn-link">
                  All bookings
                </Link>
              </div>
              {data.recent_bookings.length ? (
                <div className="list">
                  {data.recent_bookings.map((booking) => (
                    <BookingCard
                      key={booking.booking_id}
                      booking={booking}
                      actions={
                        <Link
                          to={`/bookings/${booking.booking_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Open
                        </Link>
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <h3>No bookings yet</h3>
                  <p>Book a plumber, a cleaner or a mover from the catalogue.</p>
                  <Link to="/services" className="btn btn-sm">
                    Browse services
                  </Link>
                </div>
              )}
            </section>

            <aside className="stack">
              <div>
                <div className="section-head">
                  <h2>Rides leaving soon</h2>
                </div>
                {data.upcoming_rides.length ? (
                  <div className="list">
                    {data.upcoming_rides.map((ride) => (
                      <RideCard key={ride.ride_id} ride={ride} />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <h3>No rides scheduled</h3>
                    <p>Offer one and your neighbours will see it here.</p>
                  </div>
                )}
              </div>

              <div>
                <div className="section-head">
                  <h2>Latest alerts</h2>
                  <Link to="/notifications" className="btn-link">
                    All
                  </Link>
                </div>
                <div className="list">
                  {data.recent_notifications.map((note) => (
                    <div
                      key={note.notification_id}
                      className={`list-item ${note.is_read ? '' : 'unread'}`}
                    >
                      <div className="stack-sm" style={{ flex: 1 }}>
                        <div className="row-between">
                          <strong>{note.title}</strong>
                          <small className="muted">{relative(note.created_at)}</small>
                        </div>
                        <small>{note.message}</small>
                        <div>
                          <StatusBadge status={note.type} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!data.recent_notifications.length && (
                    <p className="muted">Nothing yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  )
}
