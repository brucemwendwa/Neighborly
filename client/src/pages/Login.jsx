import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_HOME } from '../config/nav'
import { Field } from '../components/ui'

/**
 * Sign in — POST /api/auth/login.
 *
 * On success the context stores the token and the user, and we return the
 * visitor to wherever they were headed before ProtectedRoute intercepted
 * them (that origin is carried in location.state.from).
 */
const DEMO_ACCOUNTS = [
  ['amina@example.com', 'Resident'],
  ['caleb@example.com', 'Provider'],
  ['gate@jiranihub.co.ke', 'Security'],
  ['admin@jiranihub.co.ke', 'Admin'],
]

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const signedIn = await login(form)
      // Back to wherever ProtectedRoute intercepted them, otherwise into their
      // own workspace — a guard signing in wants the gate desk, not the
      // resident dashboard they have no use for.
      const fallback = ROLE_HOME[signedIn.role] ?? '/home'
      navigate(location.state?.from?.pathname || fallback, { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="form-page">
      <div className="panel">
        <h1>Sign in</h1>
        <p className="muted">Welcome back to your estate.</p>

        <form onSubmit={handleSubmit} className="form" style={{ marginTop: '1.25rem' }}>
          <Field
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {error && <p className="notice">{error}</p>}

          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted small" style={{ marginTop: '1.25rem' }}>
          New here? <Link to="/register" className="btn-link">Create an account</Link>
        </p>
      </div>

      {/* Convenience for the demo — the seeded accounts all share one
          password, so the reviewer can switch roles in two clicks. */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h3>Demo accounts</h3>
        <p className="muted small">Password for all of them: Password123</p>
        <div className="stack-sm" style={{ marginTop: '0.6rem' }}>
          {DEMO_ACCOUNTS.map(([email, role]) => (
            <button
              key={email}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setForm({ email, password: 'Password123' })}
            >
              {role} — {email}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
