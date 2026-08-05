import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { estates } from '../api'
import { useApi } from '../hooks/useApi'
import { Field } from '../components/ui'

/**
 * Create an account — POST /api/auth/register.
 *
 * The estate dropdown is filled from GET /api/estates, which is public for
 * exactly this reason: you have to choose your community before you have a
 * token. Choosing "provider" reveals a bio field, which the same request
 * turns into a ServiceProvider profile.
 *
 * Field-level errors come back as {error, details: {field: [msg]}}, and the
 * fetch wrapper flattens the top-level message; `details` is read here
 * so the message lands under the field that caused it.
 */
export default function Register() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'resident',
    estate_id: '',
    bio: '',
  })
  const [error, setError] = useState(null)
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const { data: estateData } = useApi(() => estates.list(), [])

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await register(form)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="form-page">
      <div className="panel">
        <h1>Join Jirani Hub</h1>
        <p className="muted">
          One account for services, housing, moving, commuting and gate passes.
        </p>

        <form onSubmit={handleSubmit} className="form" style={{ marginTop: '1.25rem' }}>
          <Field
            label="Full name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            required
            minLength={2}
          />

          <div className="form-row">
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
              label="Phone"
              name="phone"
              placeholder="+254712345678"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
          />

          <div className="form-row">
            <Field
              label="I am joining as"
              as="select"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              <option value="resident">A resident</option>
              <option value="provider">A service provider</option>
              <option value="security">Estate security</option>
            </Field>

            <Field
              label="Estate"
              as="select"
              name="estate_id"
              value={form.estate_id}
              onChange={handleChange}
              required
            >
              <option value="">Choose your estate…</option>
              {estateData?.items?.map((estate) => (
                <option key={estate.estate_id} value={estate.estate_id}>
                  {estate.estate_name} — {estate.city}
                </option>
              ))}
            </Field>
          </div>

          {form.role === 'provider' && (
            <Field
              label="What do you do?"
              as="textarea"
              name="bio"
              hint="An administrator reviews this before you can accept jobs."
              value={form.bio}
              onChange={handleChange}
              placeholder="Licensed plumber, 6 years around Ruaka. Same-day callouts."
            />
          )}

          {error && <p className="notice">{error}</p>}

          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="muted small" style={{ marginTop: '1.25rem' }}>
          Already have an account?{' '}
          <Link to="/sign-in" className="btn-link">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  )
}
