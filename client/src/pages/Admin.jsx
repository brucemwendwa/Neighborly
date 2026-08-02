import { useState } from 'react'
import { Link } from 'react-router-dom'
import { categories, dashboard, estates, listings, providers, services, users } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import {
  Avatar,
  Empty,
  Field,
  Loading,
  Modal,
  PageHeader,
  Results,
  Stat,
  StatusBadge,
} from '../components/ui'
import { ProviderCard } from '../components/cards'
import { date, money } from '../utils/format'

/**
 * Admin console — the queues an estate admin actually works through.
 *
 * Approving providers and verifying listings is the platform's trust
 * model: a resident booking a stranger is relying on somebody having
 * checked. Everything here is admin-only server-side too.
 */
const TABS = [
  ['overview', 'Overview'],
  ['providers', 'Provider approvals'],
  ['listings', 'Listing verification'],
  ['catalogue', 'Catalogue'],
  ['people', 'People'],
  ['estates', 'Estates'],
]

export default function Admin() {
  const [tab, setTab] = useState('overview')

  return (
    <>
      <PageHeader
        title="Admin"
        description="Approvals, verification and the shared service catalogue."
      />

      <div className="tabs">
        {TABS.map(([key, text]) => (
          <button
            key={key}
            type="button"
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'providers' && <ProviderQueue />}
      {tab === 'listings' && <ListingQueue />}
      {tab === 'catalogue' && <Catalogue />}
      {tab === 'people' && <People />}
      {tab === 'estates' && <Estates />}
    </>
  )
}

function Overview() {
  const { data, loading, error } = useApi(() => dashboard.admin(), [])
  if (loading) return <Loading rows={2} />
  if (error) return <div className="notice">{error}</div>

  const s = data.summary
  return (
    <section className="stats">
      <Stat value={s.users} label="Users" />
      <Stat value={s.residents} label="Residents" />
      <Stat value={s.providers} label="Providers" />
      <Stat value={s.providers_awaiting_approval} label="Awaiting approval" />
      <Stat value={s.bookings} label="Bookings" />
      <Stat value={s.bookings_pending} label="Pending bookings" />
      <Stat value={s.listings} label="Listings" />
      <Stat value={s.listings_unverified} label="Unverified listings" />
      <Stat value={s.rides_active} label="Active rides" />
      <Stat value={s.moves_open} label="Open moves" />
      <Stat value={money(s.revenue)} label="Payments cleared" />
    </section>
  )
}

function ProviderQueue() {
  const toast = useToast()
  const [approved, setApproved] = useState('false')
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => providers.list({ approved, per_page: 50 }),
    [approved]
  )

  const set = (provider, changes, message) =>
    run(
      () => providers.setVerification(provider.provider_id, changes),
      () => {
        toast.success(message)
        reload()
      }
    )

  return (
    <>
      <div className="filters">
        <Field
          label="Show"
          as="select"
          value={approved}
          onChange={(e) => setApproved(e.target.value)}
        >
          <option value="false">Awaiting approval</option>
          <option value="true">Approved</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="Nothing in this queue" />}
      >
        <div className="grid-2">
          {data?.items?.map((provider) => (
            <ProviderCard
              key={provider.provider_id}
              provider={provider}
              action={
                <>
                  {!provider.is_verified && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_verified: true }, 'Marked verified')
                      }
                    >
                      Mark verified
                    </button>
                  )}
                  {provider.is_approved ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_approved: false }, 'Provider suspended')
                      }
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_approved: true }, 'Provider approved')
                      }
                    >
                      Approve
                    </button>
                  )}
                </>
              }
            />
          ))}
        </div>
      </Results>
    </>
  )
}

function ListingQueue() {
  const toast = useToast()
  const [verified, setVerified] = useState('false')
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => listings.list({ verified, per_page: 50 }),
    [verified]
  )

  const setVerification = (listing, value) =>
    run(
      () => listings.setVerification(listing.listing_id, { is_verified: value }),
      () => {
        toast.success(value ? 'Listing verified' : 'Verification removed')
        reload()
      }
    )

  return (
    <>
      <div className="filters">
        <Field
          label="Show"
          as="select"
          value={verified}
          onChange={(e) => setVerified(e.target.value)}
        >
          <option value="false">Unverified</option>
          <option value="true">Verified</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="Nothing to verify" />}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Estate</th>
                <th>Landlord</th>
                <th>Rent</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((listing) => (
                <tr key={listing.listing_id}>
                  <td>
                    <Link to={`/listings/${listing.listing_id}`} className="btn-link">
                      {listing.title}
                    </Link>
                  </td>
                  <td>{listing.estate?.estate_name}</td>
                  <td>{listing.landlord?.full_name}</td>
                  <td>{money(listing.rent_price)}</td>
                  <td>
                    <StatusBadge status={listing.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() => setVerification(listing, !listing.is_verified)}
                    >
                      {listing.is_verified ? 'Unverify' : 'Verify'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Results>
    </>
  )
}

function Catalogue() {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const { run, pending } = useAction()
  const cats = useApi(() => categories.list(), [])
  const svcs = useApi(() => services.list({ per_page: 100 }), [])

  const removeService = (service) =>
    run(() => services.remove(service.service_id), () => {
      toast.success('Service removed')
      svcs.reload()
    })

  return (
    <>
      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <h2>Services</h2>
        <button type="button" className="btn" onClick={() => setEditing({})}>
          Add service
        </button>
      </div>

      <Results
        loading={svcs.loading}
        error={svcs.error}
        onRetry={svcs.reload}
        items={svcs.data?.items}
        empty={<Empty title="The catalogue is empty" />}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>From</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {svcs.data?.items?.map((service) => (
                <tr key={service.service_id}>
                  <td>{service.name}</td>
                  <td>{service.category?.name}</td>
                  <td>{money(service.base_price)}</td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing(service)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() => removeService(service)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Results>

      <div className="section">
        <h2>Categories</h2>
        <div className="grid">
          {cats.data?.items?.map((category) => (
            <article key={category.category_id} className="card">
              <div className="row-between">
                <h3>{category.name}</h3>
                <span className="badge">{category.service_count}</span>
              </div>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
      </div>

      {editing && (
        <ServiceForm
          service={editing}
          categories={cats.data?.items || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Saved')
            svcs.reload()
            cats.reload()
          }}
        />
      )}
    </>
  )
}

function ServiceForm({ service, categories: categoryList, onClose, onSaved }) {
  const isEdit = Boolean(service.service_id)
  const [form, setForm] = useState({
    name: service.name || '',
    category_id: service.category_id || categoryList[0]?.category_id || '',
    description: service.description || '',
    base_price: service.base_price || '',
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title={isEdit ? 'Edit service' : 'Add a service'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              isEdit
                ? services.update(service.service_id, form)
                : services.create(form),
            onSaved
          )
        }}
      >
        <Field label="Name" name="name" value={form.name} onChange={change} required />
        <Field
          label="Category"
          as="select"
          name="category_id"
          value={form.category_id}
          onChange={change}
          required
        >
          {categoryList.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </Field>
        <Field
          label="Description"
          as="textarea"
          name="description"
          value={form.description}
          onChange={change}
        />
        <Field
          label="Starting price (KES)"
          type="number"
          min="0"
          step="50"
          name="base_price"
          value={form.base_price}
          onChange={change}
          required
        />

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : 'Save service'}
        </button>
      </form>
    </Modal>
  )
}

function People() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => users.list({ q: q || undefined, role: role || undefined, per_page: 50 }),
    [q, role]
  )

  const changeRole = (person, nextRole) =>
    run(() => users.update(person.user_id, { role: nextRole }), () => {
      toast.success(`${person.full_name} is now ${nextRole}`)
      reload()
    })

  return (
    <>
      <div className="filters">
        <Field
          label="Search"
          placeholder="Name, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Field label="Role" as="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="resident">Residents</option>
          <option value="provider">Providers</option>
          <option value="security">Security</option>
          <option value="admin">Admins</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="Nobody matches that" />}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Estate</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((person) => (
                <tr key={person.user_id}>
                  <td>
                    <span className="row">
                      <Avatar user={person} />
                      {person.full_name}
                    </span>
                  </td>
                  <td className="small">
                    {person.email}
                    <br />
                    {person.phone}
                  </td>
                  <td>{person.estate?.estate_name || '—'}</td>
                  <td>
                    <span className="badge badge-info">{person.role}</span>
                  </td>
                  <td>{date(person.created_at)}</td>
                  <td>
                    <select
                      value={person.role}
                      disabled={pending}
                      onChange={(e) => changeRole(person, e.target.value)}
                    >
                      {['resident', 'provider', 'security', 'admin'].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Results>
    </>
  )
}

function Estates() {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const { data, loading, error, reload } = useApi(() => estates.list(), [])

  return (
    <>
      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <h2>Estates</h2>
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          Add estate
        </button>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="No estates yet" />}
      >
        <div className="grid">
          {data?.items?.map((estate) => (
            <article key={estate.estate_id} className="card">
              <div className="row-between">
                <h3>{estate.estate_name}</h3>
                <span className="badge">{estate.resident_count} members</span>
              </div>
              <p className="muted">
                {estate.address}, {estate.city}, {estate.country}
              </p>
            </article>
          ))}
        </div>
      </Results>

      {creating && (
        <EstateForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            toast.success('Estate added')
            reload()
          }}
        />
      )}
    </>
  )
}

function EstateForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    estate_name: '',
    address: '',
    city: '',
    country: 'Kenya',
  })
  const { run, pending, error } = useAction()
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Add an estate" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => estates.create(form), onSaved)
        }}
      >
        <Field label="Name" name="estate_name" value={form.estate_name} onChange={change} required />
        <Field label="Address" name="address" value={form.address} onChange={change} required />
        <div className="form-row">
          <Field label="City" name="city" value={form.city} onChange={change} required />
          <Field label="Country" name="country" value={form.country} onChange={change} />
        </div>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : 'Add estate'}
        </button>
      </form>
    </Modal>
  )
}
