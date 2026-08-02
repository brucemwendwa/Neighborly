import { Link, useParams } from 'react-router-dom'
import { listings } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Loading, PageHeader, StatusBadge } from '../components/ui'
import { date, money } from '../utils/format'

/** A single unit: photos, the numbers, and how to reach the landlord. */
export default function ListingDetail() {
  const { listingId } = useParams()
  const { isAdmin, isAuthenticated } = useAuth()
  const toast = useToast()
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => listings.get(listingId),
    [listingId]
  )

  if (loading) return <Loading />
  if (error) return <div className="notice">{error}</div>

  const listing = data?.listing
  if (!listing) return null

  const setVerified = (value) =>
    run(
      () => listings.setVerification(listingId, { is_verified: value }),
      () => {
        toast.success(value ? 'Listing verified' : 'Verification removed')
        reload()
      }
    )

  return (
    <>
      <PageHeader
        title={listing.title}
        description={`${listing.estate?.estate_name || ''} · listed ${date(
          listing.created_at
        )}`}
      >
        <StatusBadge status={listing.status} />
        {listing.is_verified ? (
          <span className="badge badge-info">Verified</span>
        ) : (
          <span className="badge badge-warn">Unverified</span>
        )}
      </PageHeader>

      <div className="split">
        <section className="stack">
          {listing.images?.length ? (
            <div className="thumb-row">
              {listing.images.map((src) => (
                <img key={src} className="thumb" src={src} alt="" loading="lazy" />
              ))}
            </div>
          ) : (
            <div className="thumb" />
          )}

          <div className="panel">
            <h2>About this unit</h2>
            <p>{listing.description || 'The landlord has not added a description.'}</p>
            <div className="row" style={{ marginTop: '1rem' }}>
              <span className="badge badge-success">
                {money(listing.rent_price)} / month
              </span>
              <span className="badge">{listing.bedrooms} bedrooms</span>
              <span className="badge">{listing.bathrooms} bathrooms</span>
            </div>
          </div>
        </section>

        <aside className="stack">
          <div className="panel">
            <h2>Listed by</h2>
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <Avatar user={listing.landlord} large />
              <div>
                <strong>{listing.landlord?.full_name}</strong>
                <div className="muted small">
                  {listing.estate?.estate_name}, {listing.estate?.city}
                </div>
              </div>
            </div>
            {isAuthenticated ? (
              <p className="muted small" style={{ marginTop: '1rem' }}>
                Contact details are shared through the estate office. Message
                your admin to arrange a viewing.
              </p>
            ) : (
              <Link to="/login" className="btn btn-block" style={{ marginTop: '1rem' }}>
                Sign in to enquire
              </Link>
            )}
          </div>

          {isAdmin && (
            <div className="panel">
              <h3>Admin</h3>
              <p className="muted small">
                Verification is what makes a listing trustworthy — only mark it
                once you have seen the unit.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                disabled={pending}
                onClick={() => setVerified(!listing.is_verified)}
              >
                {listing.is_verified ? 'Remove verification' : 'Mark as verified'}
              </button>
            </div>
          )}
        </aside>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link to="/listings" className="btn-link">
          ← Back to housing
        </Link>
      </p>
    </>
  )
}
