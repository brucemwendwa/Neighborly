import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listings } from '../../api'
import { useApi, useAction } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Empty, Field, Results, StatusBadge } from '../../components/ui'
import { money } from '../../utils/format'

/** Listing verification — the badge a renter actually trusts. */
export default function ListingQueue() {
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
