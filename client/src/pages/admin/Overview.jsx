import { dashboard } from '../../api'
import { useApi } from '../../hooks/useApi'
import { Loading, PageHeader, Stat } from '../../components/ui'
import { money } from '../../utils/format'

/**
 * The admin overview: platform totals, then the three analytics tables.
 *
 * The totals come from GET /api/dashboard/admin; the tables come from
 * GET /api/dashboard/insights, where each one is a single grouped, joined
 * query rather than a list the client counts.
 */
export default function Overview() {
  const { data, loading, error } = useApi(() => dashboard.admin(), [])
  const {
    data: insights,
    loading: loadingInsights,
    error: insightsError,
  } = useApi(() => dashboard.insights(), [])

  if (loading) return <Loading rows={2} />
  if (error) return <div className="notice">{error}</div>

  const s = data.summary
  return (
    <>
      <PageHeader
        title="Global overview"
        description="Platform-wide totals across every estate."
      />

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

      {insightsError && <div className="notice">{insightsError}</div>}
      {loadingInsights && <Loading rows={2} />}

      {insights && (
        <div className="section grid-2">
          <InsightTable
            title="Value by category"
            hint="bookings joined to services and categories, grouped and summed"
            columns={['Category', 'Bookings', 'Value']}
            rows={insights.revenue_by_category.map((r) => [
              r.category,
              r.bookings,
              money(r.value),
            ])}
          />

          <InsightTable
            title="Top providers"
            hint="completed jobs per provider, ranked by earnings"
            columns={['Provider', 'Jobs', 'Earned']}
            rows={insights.top_providers.map((r) => [
              r.provider,
              r.jobs,
              money(r.earned),
            ])}
          />

          <InsightTable
            title="Marketplace demand"
            hint="requests per resident and the quotes they attracted"
            columns={['Resident', 'Requests', 'Quotes']}
            rows={insights.demand_by_resident.map((r) => [
              r.resident,
              r.requests,
              r.quotes_received,
            ])}
          />
        </div>
      )}
    </>
  )
}

function InsightTable({ title, hint, columns, rows }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>

      {rows.length === 0 ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Nothing to report yet.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
