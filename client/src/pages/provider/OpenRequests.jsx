import { Link } from 'react-router-dom'
import { requests } from '../../api'
import { useApi } from '../../hooks/useApi'
import { Empty, PageHeader, Results } from '../../components/ui'
import { money, relative } from '../../utils/format'

/**
 * The provider's job board: work posted in their estate that is still taking
 * quotes.
 *
 * The API already scopes this to the caller's estate and to open requests,
 * so there is no filter here to get wrong — a provider cannot browse another
 * community's jobs by editing a query string.
 */
export default function OpenRequests() {
  const { data, loading, error, reload } = useApi(() => requests.list(), [])

  return (
    <>
      <PageHeader
        title="Open requests"
        description="Jobs residents in your estate have put out for quotes."
      />

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title="No open requests">
            Nothing is waiting for a quote in your estate right now.
          </Empty>
        }
      >
        <div className="grid-wide">
          {data?.items?.map((item) => (
            <Link
              key={item.request_id}
              to={`/requests/${item.request_id}`}
              className="card card-link"
            >
              <div className="row-between">
                <h3>{item.title}</h3>
                <span className="badge">
                  {item.quote_count} {item.quote_count === 1 ? 'quote' : 'quotes'}
                </span>
              </div>

              {item.description && <p className="muted">{item.description}</p>}

              <div className="row" style={{ marginTop: '0.75rem' }}>
                {item.budget_max && (
                  <span className="badge badge-info">
                    budget to {money(item.budget_max)}
                  </span>
                )}
                {/* What the provider actually needs to decide whether to bid:
                    the price they would have to beat. */}
                {item.lowest_quote && (
                  <span className="badge badge-warn">
                    best so far {money(item.lowest_quote)}
                  </span>
                )}
                <small className="muted push-right">{relative(item.created_at)}</small>
              </div>
            </Link>
          ))}
        </div>
      </Results>
    </>
  )
}
