import { useState } from 'react'
import { auth, estates, providers, reviews } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Field, PageHeader, Stars } from '../components/ui'
import { ReviewItem } from '../components/cards'
import { date, money } from '../utils/format'

/**
 * Your account: profile, password, and — if you take jobs — your provider
 * profile and the reviews people have left you.
 *
 * Three separate forms hitting three separate endpoints on purpose. A
 * profile edit must not be able to change a role or a password, so the
 * server exposes them separately and the UI mirrors that.
 */
export default function Profile() {
  const { user, refreshUser, isProvider } = useAuth()
  const toast = useToast()
  const { data: estateData } = useApi(() => estates.list(), [])
  const { data: reviewData } = useApi(
    () => reviews.list({ reviewee_id: user.user_id }),
    [user.user_id]
  )

  return (
    <>
      <PageHeader title="Your profile" description="Account details and settings." />

      <div className="split">
        <section className="stack">
          <ProfileForm
            user={user}
            estates={estateData?.items || []}
            onSaved={async () => {
              await refreshUser()
              toast.success('Profile updated')
            }}
          />
          <PasswordForm onSaved={() => toast.success('Password changed')} />
          <ProviderPanel
            user={user}
            isProvider={isProvider}
            onSaved={async (message) => {
              await refreshUser()
              toast.success(message)
            }}
          />
        </section>

        <aside className="stack">
          <div className="panel">
            <div className="row">
              <Avatar user={user} large />
              <div>
                <strong>{user.full_name}</strong>
                <div className="muted small">{user.email}</div>
              </div>
            </div>
            <div className="stack-sm" style={{ marginTop: '1rem' }}>
              <div className="row-between">
                <span className="muted">Role</span>
                <span className="badge badge-info">{user.role}</span>
              </div>
              <div className="row-between">
                <span className="muted">Estate</span>
                <strong>{user.estate?.estate_name || 'Not set'}</strong>
              </div>
              <div className="row-between">
                <span className="muted">Wallet</span>
                <strong>{money(user.wallet?.balance)}</strong>
              </div>
              <div className="row-between">
                <span className="muted">Member since</span>
                <strong>{date(user.created_at)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Reviews about you</h3>
            {reviewData?.items?.length ? (
              <div className="list" style={{ marginTop: '0.75rem' }}>
                {reviewData.items.map((review) => (
                  <ReviewItem key={review.review_id} review={review} />
                ))}
              </div>
            ) : (
              <p className="muted small">
                Nothing yet. Reviews arrive after a completed booking.
              </p>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function ProfileForm({ user, estates: estateList, onSaved }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    phone: user.phone,
    estate_id: user.estate_id || '',
    profile_picture: user.profile_picture || '',
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <div className="panel">
      <h2>Details</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              auth.updateMe({
                ...form,
                profile_picture: form.profile_picture || null,
              }),
            onSaved
          )
        }}
      >
        <div className="form-row">
          <Field label="Full name" name="full_name" value={form.full_name} onChange={change} />
          <Field label="Phone" name="phone" value={form.phone} onChange={change} />
        </div>
        <Field
          label="Estate"
          as="select"
          name="estate_id"
          value={form.estate_id}
          onChange={change}
        >
          <option value="">Not set</option>
          {estateList.map((estate) => (
            <option key={estate.estate_id} value={estate.estate_id}>
              {estate.estate_name} — {estate.city}
            </option>
          ))}
        </Field>
        <Field
          label="Profile picture URL"
          name="profile_picture"
          value={form.profile_picture}
          onChange={change}
          placeholder="https://…"
        />

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}

function PasswordForm({ onSaved }) {
  const [form, setForm] = useState({ current_password: '', new_password: '' })
  const { run, pending, error } = useAction()

  return (
    <div className="panel">
      <h2>Password</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => auth.changePassword(form), () => {
            setForm({ current_password: '', new_password: '' })
            onSaved()
          })
        }}
      >
        <div className="form-row">
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={form.current_password}
            onChange={(e) =>
              setForm((f) => ({ ...f, current_password: e.target.value }))
            }
            required
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            value={form.new_password}
            onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
            required
            minLength={8}
          />
        </div>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-ghost" disabled={pending}>
          {pending ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}

function ProviderPanel({ user, isProvider, onSaved }) {
  const profile = user.provider_profile
  const [bio, setBio] = useState(profile?.bio || '')
  const { run, pending, error } = useAction()

  return (
    <div className="panel">
      <h2>Provider profile</h2>

      {isProvider ? (
        <>
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            {profile.is_verified ? (
              <span className="badge badge-info">Verified</span>
            ) : (
              <span className="badge badge-warn">Not verified</span>
            )}
            {profile.is_approved ? (
              <span className="badge badge-success">Approved to work</span>
            ) : (
              <span className="badge badge-warn">Awaiting approval</span>
            )}
            <Stars value={profile.rating} count={profile.review_count} />
          </div>

          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => providers.updateMine({ bio }), () => onSaved('Bio updated'))
            }}
          >
            <Field
              label="Bio"
              as="textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              hint="What you do, how long you have been doing it, when you are available."
            />
            {error && <p className="notice">{error}</p>}
            <button type="submit" className="btn btn-ghost" disabled={pending}>
              {pending ? 'Saving…' : 'Save bio'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="muted">
            Take jobs from your neighbours. An administrator reviews new
            providers before they can accept work.
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => providers.createMine({ bio }), () =>
                onSaved('Provider profile created — an admin will review it')
              )
            }}
          >
            <Field
              label="What do you do?"
              as="textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Licensed electrician, 6 years around Ruaka."
            />
            {error && <p className="notice">{error}</p>}
            <button type="submit" className="btn" disabled={pending}>
              {pending ? 'Creating…' : 'Become a provider'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
