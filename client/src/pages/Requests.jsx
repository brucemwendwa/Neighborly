import { Link } from 'react-router-dom'
import { requests } from '../api'
import { useApi } from '../hooks/useApi'
import { Empty, PageHeader, Results, StatusBadge } from '../components/ui'
import { money, relative } from '../utils/format'

/**
 * The resident's own requests — jobs they have put out for quotes.
 *
 * Distinct from /bookings on purpose: a booking is work that is happening,
 * with a provider and a price. A request is the step before that, when
 * neither is decided yet. Once a quote is accepted the request turns into a
 * booking and this page hands it over.
 */
export default function Requests() {
  const { data, loading, error, reload } = useApi(() => requests.mine(), [])

  return (
    <>
      <PageHeader
        title="My requests"
        description="Jobs you have put out to the estate. Providers quote, you pick."
      >
        <Link to="/services/request" className="btn">
          Post a request
        </Link>
      </PageHeader>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty
            title="No requests yet"
            action={
              <Link to="/services/request" className="btn btn-sm">
                Post a request
              </Link>
            }
          >
            Describe a job and providers in your estate will quote for it.
          </Empty>
        }
      >
        <div className="list">
          {data?.items?.map((item) => (
            <Link
              key={item.request_id}
              to={`/requests/${item.request_id}`}
              className="list-item card-link"
            >
              <div className="stack-sm" style={{ flex: 1 }}>
                <div className="row-between">
                  <strong>{item.title}</strong>
                  <StatusBadge status={item.status} />
                </div>

                <small className="muted">
                  Posted {relative(item.created_at)}
                  {item.budget_max
                    ? ` · budget up to ${money(item.budget_max)}`
                    : ''}
                </small>

                <div className="row">
                  {/* The two numbers worth showing in a list: how much
                      interest it drew, and what the best offer is. */}
                  <span className="badge">
                    {item.quote_count} {item.quote_count === 1 ? 'quote' : 'quotes'}
                  </span>
                  {item.lowest_quote && (
                    <span className="badge badge-success">
                      from {money(item.lowest_quote)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Results>
    </>
  )
}
