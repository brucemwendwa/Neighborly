import { Link } from 'react-router-dom'
import { categories } from '../api'
import { useApi } from '../hooks/useApi'
import { Loading } from '../components/ui'

/**
 * The public landing page — the shop window, shown to anyone signed out.
 *
 * It sits outside the workspace shells on purpose: a visitor has no workspace
 * yet, and wrapping the pitch in a resident sidebar would advertise navigation
 * they cannot use.
 */
const PILLARS = [
  {
    title: 'Services',
    body: 'Book a plumber, cleaner or electrician who already works in your estate.',
    to: '/services',
  },
  {
    title: 'Housing',
    body: 'Browse verified vacant units without going through a broker.',
    to: '/find-and-move',
  },
  {
    title: 'Moving',
    body: 'Request a truck, loaders and packers as one job.',
    to: '/find-and-move/moving',
  },
  {
    title: 'Commute',
    body: 'Share the drive to town with neighbours going your way.',
    to: '/commute',
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

const STEPS = [
  ['1. Request', 'Pick a service and describe the job. It costs nothing to ask.'],
  ['2. Accepted', 'An approved provider in your estate takes the job.'],
  ['3. Done', 'Work is marked complete, you pay, and you leave a review.'],
]

export default function Landing() {
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
            <Link to="/sign-up" className="btn">
              Join your estate
            </Link>
            <Link to="/services" className="btn btn-ghost">
              Browse services
            </Link>
          </div>
          <div className="row trust-row">
            <span>Escrow-protected payments</span>
            <span>Verified providers</span>
            <span>M-Pesa &amp; cards</span>
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
          {STEPS.map(([title, body]) => (
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
