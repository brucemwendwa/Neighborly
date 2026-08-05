import { Link, Outlet } from 'react-router-dom'
import Logo from './Logo'

/**
 * Split-screen chrome for sign-in, sign-up and onboarding.
 *
 * The brand panel carries the reasons to trust the platform with a phone
 * number and an estate address; the form sits on the plain canvas beside it.
 * Below 900px the panel is dropped rather than stacked — on a phone it would
 * push the form itself below the fold, which is the one thing this screen
 * exists to show.
 */
export default function AuthLayout() {
  return (
    <div className="auth-split">
      <aside className="auth-brand gradient-dusk">
        <Link to="/" className="ws-brand">
          <Logo tone="light" />
        </Link>

        <div>
          <h2>Your estate, organised.</h2>
          <p>
            One account covers booking a plumber, paying from your wallet,
            issuing a gate pass and claiming a seat on tomorrow&apos;s commute.
          </p>
        </div>

        <ul className="auth-points">
          <li>Providers are verified before they can take a job</li>
          <li>Payments are held until the work is marked done</li>
          <li>Everything is scoped to the estate you live in</li>
        </ul>
      </aside>

      <main className="auth-form-side">
        <div className="form-page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
