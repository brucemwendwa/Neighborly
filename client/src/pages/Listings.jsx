import { useState } from 'react'
import { listings } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, Field, Modal, PageHeader, Pagination, Results } from '../components/ui'
import { ListingCard } from '../components/cards'

/**
 * Housing: browse what is vacant, and manage what you have advertised.
 *
 * Browsing is public (GET /api/listings), so this page works signed out.
 * The "My listings" tab and the create form appear only once there is a
 * user, because both are scoped to the token server-side.
 */
export default function Listings() {
  const { isAuthenticated, user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('browse')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [filters, setFilters] = useState({
    q: '',
    bedrooms: '',
    max_price: '',
    verified: '',
  })
  const { run, pending } = useAction()

  const { data, loading, error, reload } = useApi(
    () =>
      tab === 'mine'
        ? listings.mine({ page })
        : listings.list({
            page,
            status: 'vacant',
            estate_id: user?.estate_id || undefined,
            q: filters.q || undefined,
            bedrooms: filters.bedrooms || undefined,
            max_price: filters.max_price || undefined,
            verified: filters.verified || undefined,
          }),
    [tab, page, filters, user?.estate_id]
  )

  const setFilter = (key, value) => {
    setPage(1)
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const remove = (listing) =>
    run(() => listings.remove(listing.listing_id), () => {
      toast.success('Listing removed')
      reload()
    })

  return (
    <>
      <PageHeader
        title="Housing"
        description={
          user?.estate?.estate_name
            ? `Vacant units in ${user.estate.estate_name} and nearby estates.`
            : 'Vacant units listed by residents, verified by estate admins.'
        }
      >
        {isAuthenticated && (
          <button type="button" className="btn" onClick={() => setEditing({})}>
            List a unit
          </button>
        )}
      </PageHeader>

      {isAuthenticated && (
        <div className="tabs">
          {[
            ['browse', 'Browse'],
            ['mine', 'My listings'],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={`tab ${tab === key ? 'active' : ''}`}
              onClick={() => {
                setTab(key)
                setPage(1)
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {tab === 'browse' && (
        <div className="filters">
          <Field
            label="Search"
            placeholder="2 bedroom, studio…"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
          <Field
            label="Bedrooms (min)"
            as="select"
            value={filters.bedrooms}
            onChange={(e) => setFilter('bedrooms', e.target.value)}
          >
            <option value="">Any</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </Field>
          <Field
            label="Max rent (KES)"
            type="number"
            min="0"
            step="1000"
            value={filters.max_price}
            onChange={(e) => setFilter('max_price', e.target.value)}
          />
          <Field
            label="Verified"
            as="select"
            value={filters.verified}
            onChange={(e) => setFilter('verified', e.target.value)}
          >
            <option value="">All listings</option>
            <option value="true">Verified only</option>
          </Field>
        </div>
      )}

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title={tab === 'mine' ? 'You have not listed anything' : 'No units match'}>
            {tab === 'mine'
              ? 'List a vacant unit and neighbours will find it here.'
              : 'Try a wider price range or fewer bedrooms.'}
          </Empty>
        }
      >
        <div className="grid-wide">
          {data?.items?.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing}>
              {tab === 'mine' && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditing(listing)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={pending}
                    onClick={() => remove(listing)}
                  >
                    Delete
                  </button>
                </>
              )}
            </ListingCard>
          ))}
        </div>
      </Results>

      <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />

      {editing && (
        <ListingForm
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Listing saved')
            setTab('mine')
            reload()
          }}
        />
      )}
    </>
  )
}

/**
 * Create and edit share one form: the only difference is POST vs PATCH and
 * which fields start filled. Two nearly identical components would drift.
 */
function ListingForm({ listing, onClose, onSaved }) {
  const isEdit = Boolean(listing.listing_id)
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    rent_price: listing.rent_price || '',
    bedrooms: listing.bedrooms ?? 1,
    bathrooms: listing.bathrooms ?? 1,
    status: listing.status || 'vacant',
    images: (listing.images || []).join('\n'),
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const payload = {
      title: form.title,
      description: form.description || null,
      rent_price: form.rent_price,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      status: form.status,
      // One URL per line is the simplest thing that works without an
      // upload pipeline; the column is a JSON array of strings.
      images: form.images
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }
    run(
      () =>
        isEdit
          ? listings.update(listing.listing_id, payload)
          : listings.create(payload),
      onSaved
    )
  }

  return (
    <Modal title={isEdit ? 'Edit listing' : 'List a unit'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field
          label="Title"
          name="title"
          value={form.title}
          onChange={change}
          placeholder="2 bedroom apartment, Block C"
          required
          minLength={4}
        />
        <Field
          label="Description"
          as="textarea"
          name="description"
          value={form.description}
          onChange={change}
          placeholder="Floor, water situation, parking, when it is available."
        />
        <div className="form-row">
          <Field
            label="Rent per month (KES)"
            type="number"
            min="0"
            step="500"
            name="rent_price"
            value={form.rent_price}
            onChange={change}
            required
          />
          <Field
            label="Status"
            as="select"
            name="status"
            value={form.status}
            onChange={change}
          >
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </Field>
        </div>
        <div className="form-row">
          <Field
            label="Bedrooms"
            type="number"
            min="0"
            max="20"
            name="bedrooms"
            value={form.bedrooms}
            onChange={change}
          />
          <Field
            label="Bathrooms"
            type="number"
            min="0"
            max="20"
            name="bathrooms"
            value={form.bathrooms}
            onChange={change}
          />
        </div>
        <Field
          label="Image URLs"
          as="textarea"
          name="images"
          hint="One per line."
          value={form.images}
          onChange={change}
        />

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish listing'}
        </button>
      </form>
    </Modal>
  )
}
