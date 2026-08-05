import { useState } from 'react'
import { rides } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, Field, Modal, PageHeader, Pagination, Results, StatusBadge } from '../components/ui'
import { RideCard } from '../components/cards'
import { dateTime, money, toApiDate } from '../utils/format'

/**
 * Commute: find a seat, or offer one.
 *
 * Seats left comes from the API (derived from the seat bookings, not a
 * stored counter), so the number on the card is always the truth even if
 * somebody claimed the last seat a second ago.
 */
export default function Rides() {
  const toast = useToast()
  const { user } = useAuth()
  const [tab, setTab] = useState('browse')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState({ from: '', to: '' })
  const [offering, setOffering] = useState(false)
  const [claiming, setClaiming] = useState(null)
  const { run, pending } = useAction()

  const browse = useApi(
    () =>
      rides.list({
        page,
        from: search.from || undefined,
        to: search.to || undefined,
      }),
    [page, search],
    { enabled: tab === 'browse' }
  )
  const mine = useApi(() => rides.mine(), [], { enabled: tab === 'mine' })

  const reloadAll = () => {
    browse.reload()
    mine.reload()
  }

  const act = (action, message) =>
    run(action, () => {
      toast.success(message)
      reloadAll()
    })

  return (
    <>
      <PageHeader
        title="Commute"
        description="Neighbours heading the same way, at the same time. Claim a seat or
          offer the ones you are not using."
      >
        <button type="button" className="btn" onClick={() => setOffering(true)}>
          Offer a ride
        </button>
      </PageHeader>

      <div className="tabs">
        {[
          ['browse', 'Find a ride'],
          ['mine', 'My rides'],
        ].map(([key, text]) => (
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

      {tab === 'browse' ? (
        <>
          <div className="filters">
            <Field
              label="From"
              placeholder="Greenview"
              value={search.from}
              onChange={(e) => {
                setPage(1)
                setSearch((s) => ({ ...s, from: e.target.value }))
              }}
            />
            <Field
              label="To"
              placeholder="Westlands"
              value={search.to}
              onChange={(e) => {
                setPage(1)
                setSearch((s) => ({ ...s, to: e.target.value }))
              }}
            />
          </div>

          <Results
            loading={browse.loading}
            error={browse.error}
            onRetry={browse.reload}
            items={browse.data?.items}
            empty={
              <Empty title="No rides going that way yet">
                Offer one yourself — someone else in the estate is probably making
                the same trip.
              </Empty>
            }
          >
            <div className="grid-wide">
              {browse.data?.items?.map((ride) => {
                // The browse board is the whole estate's rides, your own
                // included — filtering them out would hide a trip you are
                // driving from the list you check to see what is running.
                // So they stay, but the seat button does not: claim_seats
                // refuses the driver with a 409, and finding that out after
                // opening a modal and picking a seat count is not an answer
                // anyone needed to work for.
                const isDriver = ride.driver?.user_id === user?.user_id
                return (
                  <RideCard key={ride.ride_id} ride={ride}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={isDriver || !ride.seats_left}
                      onClick={() => setClaiming(ride)}
                    >
                      {isDriver ? 'You are driving' : ride.seats_left ? 'Claim a seat' : 'Full'}
                    </button>
                  </RideCard>
                )
              })}
            </div>
          </Results>

          <Pagination
            page={browse.data?.page}
            pages={browse.data?.pages}
            onChange={setPage}
          />
        </>
      ) : (
        <div className="split">
          <section>
            <div className="section-head">
              <h2>Rides I drive</h2>
            </div>
            {mine.loading ? (
              <p className="muted">Loading…</p>
            ) : mine.data?.offered?.length ? (
              <div className="list">
                {mine.data.offered.map((ride) => (
                  <RideCard key={ride.ride_id} ride={ride}>
                    {ride.status === 'active' && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() =>
                          act(
                            () => rides.update(ride.ride_id, { status: 'cancelled' }),
                            'Ride cancelled — passengers notified'
                          )
                        }
                      >
                        Cancel ride
                      </button>
                    )}
                    {ride.status === 'active' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() =>
                          act(
                            () => rides.update(ride.ride_id, { status: 'completed' }),
                            'Ride marked complete'
                          )
                        }
                      >
                        Mark complete
                      </button>
                    )}
                  </RideCard>
                ))}
              </div>
            ) : (
              <Empty title="You are not driving any rides">
                Offer a ride and it appears here.
              </Empty>
            )}
          </section>

          <aside>
            <div className="section-head">
              <h2>Seats I claimed</h2>
            </div>
            {mine.data?.joined?.length ? (
              <div className="list">
                {mine.data.joined.map((seat) => (
                  <div key={seat.ride_booking_id} className="card">
                    <div className="row-between">
                      <strong>
                        {seat.ride?.from_location} → {seat.ride?.to_location}
                      </strong>
                      <StatusBadge status={seat.status} />
                    </div>
                    <p className="muted small" style={{ marginTop: '0.35rem' }}>
                      {dateTime(seat.ride?.departure_time)} · {seat.seats_booked} seat(s) ·{' '}
                      {money(seat.amount)}
                    </p>
                    {seat.status === 'booked' && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ marginTop: '0.75rem' }}
                        disabled={pending}
                        onClick={() =>
                          act(
                            () => rides.releaseSeat(seat.ride_id),
                            'Seat released'
                          )
                        }
                      >
                        Release seat
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No seats claimed">
                Find a ride and claim a seat to see it here.
              </Empty>
            )}
          </aside>
        </div>
      )}

      {offering && (
        <RideForm
          onClose={() => setOffering(false)}
          onSaved={() => {
            setOffering(false)
            toast.success('Ride published')
            reloadAll()
          }}
        />
      )}

      {claiming && (
        <ClaimSeats
          ride={claiming}
          onClose={() => setClaiming(null)}
          onSaved={() => {
            setClaiming(null)
            toast.success('Seat claimed')
            reloadAll()
          }}
        />
      )}
    </>
  )
}

function RideForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    from_location: '',
    to_location: '',
    departure_time: '',
    return_time: '',
    available_seats: 3,
    price_per_seat: '',
    recurrence: 'none',
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Offer a ride" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              rides.create({
                ...form,
                available_seats: Number(form.available_seats),
                price_per_seat: form.price_per_seat || 0,
                departure_time: toApiDate(form.departure_time),
                return_time: toApiDate(form.return_time),
              }),
            onSaved
          )
        }}
      >
        <div className="form-row">
          <Field
            label="From"
            name="from_location"
            value={form.from_location}
            onChange={change}
            required
          />
          <Field
            label="To"
            name="to_location"
            value={form.to_location}
            onChange={change}
            required
          />
        </div>
        <div className="form-row">
          <Field
            label="Departure"
            type="datetime-local"
            name="departure_time"
            value={form.departure_time}
            onChange={change}
            required
          />
          <Field
            label="Return (optional)"
            type="datetime-local"
            name="return_time"
            value={form.return_time}
            onChange={change}
          />
        </div>
        <div className="form-row">
          <Field
            label="Seats available"
            type="number"
            min="1"
            max="8"
            name="available_seats"
            value={form.available_seats}
            onChange={change}
          />
          <Field
            label="Price per seat (KES)"
            type="number"
            min="0"
            step="any"
            name="price_per_seat"
            value={form.price_per_seat}
            onChange={change}
          />
        </div>
        <Field
          label="Repeats"
          as="select"
          name="recurrence"
          value={form.recurrence}
          onChange={change}
        >
          <option value="none">One-off trip</option>
          <option value="daily">Every weekday</option>
          <option value="weekly">Weekly</option>
        </Field>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Publishing…' : 'Publish ride'}
        </button>
      </form>
    </Modal>
  )
}

function ClaimSeats({ ride, onClose, onSaved }) {
  const [seats, setSeats] = useState(1)
  const { run, pending, error } = useAction()

  return (
    <Modal title={`${ride.from_location} → ${ride.to_location}`} onClose={onClose}>
      <p className="muted">
        Leaves {dateTime(ride.departure_time)} · {money(ride.price_per_seat)} per seat ·{' '}
        {ride.seats_left} left
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () => rides.claimSeats(ride.ride_id, { seats_booked: Number(seats) }),
            onSaved
          )
        }}
      >
        <Field
          label="Seats"
          type="number"
          min="1"
          max={ride.seats_left}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
        <p className="muted small">
          Total: {money(Number(ride.price_per_seat) * Number(seats || 0))} — paid to the
          driver directly.
        </p>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Claiming…' : 'Claim seat'}
        </button>
      </form>
    </Modal>
  )
}
