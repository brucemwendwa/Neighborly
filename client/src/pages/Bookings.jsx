import { useState } from 'react'
import { Link } from 'react-router-dom'
import { bookings } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, PageHeader, Pagination, Results } from '../components/ui'
import { BookingCard } from '../components/cards'

/**
 * My bookings, and — for a provider — my jobs and the open job board.
 *
 * The same GET /api/bookings endpoint backs the first two tabs via its
 * `as=` parameter; the third is GET /api/bookings/available, which the
 * server scopes to unassigned pending work inside the provider's estate.
 */
export default function Bookings() {
  const { isProvider } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('customer')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const { run, pending } = useAction()

  const { data, loading, error, reload } = useApi(
    () =>
      tab === 'available'
        ? bookings.available({ page })
        : bookings.list({ as: tab, status: status || undefined, page }),
    [tab, status, page]
  )

  const act = (action, message) => run(action, () => {
    toast.success(message)
    reload()
  })

  const TABS = [
    ['customer', 'I booked'],
    ...(isProvider
      ? [
          ['provider', 'My jobs'],
          ['available', 'Open job board'],
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every job you have requested or accepted, and where each one has got to."
      >
        <Link to="/services" className="btn">
          New booking
        </Link>
      </PageHeader>

      <div className="tabs">
        {TABS.map(([key, text]) => (
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

      {tab !== 'available' && (
        <div className="filters">
          <label className="field">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      )}

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title={tab === 'available' ? 'No open jobs right now' : 'Nothing here yet'}>
            {tab === 'available'
              ? 'When a neighbour requests a service without naming a provider, it appears here.'
              : 'Book a service and it will show up on this page.'}
          </Empty>
        }
      >
        <div className="list">
          {data?.items?.map((booking) => (
            <BookingCard
              key={booking.booking_id}
              booking={booking}
              viewAs={tab === 'customer' ? 'customer' : 'provider'}
              actions={
                <>
                  <Link
                    to={`/bookings/${booking.booking_id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    Open
                  </Link>

                  {tab === 'available' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() =>
                        act(() => bookings.accept(booking.booking_id), 'Job accepted')
                      }
                    >
                      Accept job
                    </button>
                  )}

                  {tab === 'provider' && booking.status === 'accepted' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() =>
                        act(
                          () =>
                            bookings.update(booking.booking_id, {
                              status: 'in_progress',
                            }),
                          'Marked in progress'
                        )
                      }
                    >
                      Start work
                    </button>
                  )}

                  {tab === 'provider' && booking.status === 'in_progress' && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() =>
                        act(
                          () =>
                            bookings.update(booking.booking_id, {
                              status: 'completed',
                            }),
                          'Job completed'
                        )
                      }
                    >
                      Mark complete
                    </button>
                  )}

                  {tab === 'customer' &&
                    ['pending', 'accepted', 'in_progress'].includes(booking.status) && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() =>
                          act(
                            () =>
                              bookings.update(booking.booking_id, {
                                status: 'cancelled',
                              }),
                            'Booking cancelled'
                          )
                        }
                      >
                        Cancel
                      </button>
                    )}
                </>
              }
            />
          ))}
        </div>
      </Results>

      <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />
    </>
  )
}
