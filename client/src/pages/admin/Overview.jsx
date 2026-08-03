import { dashboard } from '../../api'
import { useApi } from '../../hooks/useApi'
import { Loading, Stat } from '../../components/ui'
import { money } from '../../utils/format'

/** The Overview tab — platform-wide totals from GET /api/dashboard/admin. */
export default function Overview() {
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
