import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { categories, dashboard } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading, Stat, StatusBadge } from '../components/ui'
import { BookingCard, RideCard } from '../components/cards'
import { money, relative } from '../utils/format'

/**
 * Two pages behind one route.
 *
 * Signed out, this is the pitch: what the platform does and how to join.
 * Signed in, it is the dashboard — GET /api/dashboard answers with every
 * count the tiles need in a single request rather than the client firing
 * eight list calls and counting the results.
 */
export default function Home() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Dashboard /> : <Landing />
}

const PILLARS = [
  {
    title: 'Services',
    body: 'Book a plumber, cleaner or electrician who already works in your estate.',
    to: '/services',
  },
  {
    title: 'Housing',
    body: 'Browse verified vacant units without going through a broker.',
    to: '/listings',
  },
  {
    title: 'Moving',
    body: 'Request a truck, loaders and packers as one job.',
    to: '/moves',
  },
  {
    title: 'Commute',
    body: 'Share the drive to town with neighbours going your way.',
    to: '/rides',
  },
  {
    title: 'Gate passes',
    body: 'Issue a QR code so security can admit your visitor.',
    to: '/gate-passes',
  },
  {
    title: 'Wallet',
    body: 'Pay by M-Pesa, card or stored balance, with a receipt for each job.',
    to: '/wallet',
  },
]

function Landing() {
  const { data, loading } = useApi(() => categories.list(), [])

  return (
    <>
      <section className="hero-banner">
        <div className="hero">
          <h1>Everything your estate needs, in one place.</h1>
          <p>
            Jirani Hub connects residents with trusted providers, housing, moving
            help and daily commutes — all scoped to the community you actually
            live in.
          </p>
          <div className="row" style={{ marginTop: '1.25rem' }}>
            <Link to="/register" className="btn">
              Join your estate
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Browse services
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What you can do here</h2>
        </div>
        <div className="pillars">
          {PILLARS.map((pillar) => (
            <Link key={pillar.title} to={pillar.to} className="card card-link">
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Service categories</h2>
          <Link to="/services" className="btn-link">
            See all services
          </Link>
        </div>
        {loading ? (
          <Loading rows={2} />
        ) : (
          <div className="grid">
            {data?.items?.map((category) => (
              <Link
                key={category.category_id}
                to={`/services?category_id=${category.category_id}`}
                className="card card-link"
              >
                <div className="row-between">
                  <h3>{category.name}</h3>
                  <span className="badge">{category.service_count}</span>
                </div>
                <p>{category.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How a booking works</h2>
        </div>
        <div className="grid">
          {[
            ['1. Request', 'Pick a service and describe the job. It costs nothing to ask.'],
            ['2. Accepted', 'An approved provider in your estate takes the job.'],
            ['3. Done', 'Work is marked complete, you pay, and you leave a review.'],
          ].map(([title, body]) => (
            <article key={title} className="card">
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function Dashboard() {
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
