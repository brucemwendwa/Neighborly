import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bookings, payments, reviews } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  Avatar,
  Field,
  Loading,
  Modal,
  PageHeader,
  StarPicker,
  StatusBadge,
  Timeline,
} from '../components/ui'
import { ReviewItem } from '../components/cards'
import { dateTime, label, money } from '../utils/format'

/**
 * One booking, end to end: who, what, the payment ledger and the reviews.
 *
 * Which buttons appear is derived from the same two things the API checks —
 * the current status, and whether you are the customer or the provider.
 * The server re-checks both; this only decides what is worth showing.
 */
const STEPS = ['pending', 'accepted', 'in_progress', 'completed']

export default function BookingDetail() {
  const { bookingId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { run, pending } = useAction()

  const [paying, setPaying] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const { data, loading, error, reload } = useApi(
    () => bookings.get(bookingId),
    [bookingId]
  )
  const booking = data?.booking

  if (loading) return <Loading />
  if (error) return <div className="notice">{error}</div>
  if (!booking) return null

  const isCustomer = booking.user_id === user.user_id
  const isProvider = booking.provider?.user?.user_id === user.user_id
  const outstanding = Number(booking.total_amount) - Number(booking.amount_paid)
  const alreadyReviewed = booking.reviews?.some(
    (review) => review.reviewer?.user_id === user.user_id
  )

  const act = (action, message) =>
    run(action, () => {
      toast.success(message)
      reload()
    })

  return (
    <>
      <PageHeader
        title={booking.service?.name || 'Booking'}
        description={`Requested ${dateTime(booking.created_at)}${
          booking.scheduled_date ? ` · scheduled for ${dateTime(booking.scheduled_date)}` : ''
        }`}
      >
        <StatusBadge status={booking.status} />
      </PageHeader>

      <div className="split">
        <section className="stack">
          <div className="panel">
            <h2>Progress</h2>
            {booking.status === 'cancelled' ? (
              <p className="notice">This booking was cancelled.</p>
            ) : (
              <Timeline steps={STEPS} current={booking.status} />
            )}

            <div className="row" style={{ marginTop: '1.25rem' }}>
              {isProvider && booking.status === 'accepted' && (
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => bookings.update(bookingId, { status: 'in_progress' }),
                      'Marked in progress'
                    )
                  }
                >
                  Start work
                </button>
              )}
              {isProvider && booking.status === 'in_progress' && (
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => bookings.update(bookingId, { status: 'completed' }),
                      'Job completed'
                    )
                  }
                >
                  Mark complete
                </button>
              )}
              {isCustomer && outstanding > 0 && booking.status !== 'cancelled' && (
                <button type="button" className="btn" onClick={() => setPaying(true)}>
                  Pay {money(outstanding)}
                </button>
              )}
              {booking.status === 'completed' && !alreadyReviewed && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setReviewing(true)}
                >
                  Leave a review
                </button>
              )}
              {isCustomer && ['pending', 'accepted'].includes(booking.status) && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => bookings.update(bookingId, { status: 'cancelled' }),
                      'Booking cancelled'
                    )
                  }
                >
                  Cancel booking
                </button>
              )}
              {isCustomer && booking.status === 'pending' && (
                <button
                  type="button"
                  className="btn-link"
                  disabled={pending}
                  onClick={() =>
                    run(() => bookings.remove(bookingId), () => {
                      toast.success('Booking deleted')
                      navigate('/bookings')
                    })
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="row-between">
              <h2>Payments</h2>
              <span className="badge">
                {money(booking.amount_paid)} of {money(booking.total_amount)}
              </span>
            </div>

            {booking.payments?.length ? (
              <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.payments.map((payment) => (
                      <tr key={payment.payment_id}>
                        <td>{dateTime(payment.created_at)}</td>
                        <td>{money(payment.amount)}</td>
                        <td>{label(payment.payment_method)}</td>
                        <td>
                          <StatusBadge status={payment.status} />
                        </td>
                        <td className="mono small">{payment.transaction_ref || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Nothing paid yet.</p>
            )}
          </div>

          <div className="panel">
            <h2>Reviews</h2>
            {booking.reviews?.length ? (
              <div className="list">
                {booking.reviews.map((review) => (
                  <ReviewItem key={review.review_id} review={review} />
                ))}
              </div>
            ) : (
              <p className="muted">
                Reviews can be left once the job is marked complete.
              </p>
            )}
          </div>
        </section>

        <aside className="stack">
          <div className="panel">
            <h2>Details</h2>
            <div className="stack-sm" style={{ marginTop: '0.75rem' }}>
              <div className="row-between">
                <span className="muted">Type</span>
                <strong>{label(booking.booking_type)}</strong>
              </div>
              <div className="row-between">
                <span className="muted">Total</span>
                <strong>{money(booking.total_amount)}</strong>
              </div>
              <div className="row-between">
                <span className="muted">Customer</span>
                <span className="user-chip">
                  <Avatar user={booking.customer} />
                  {booking.customer?.full_name}
                </span>
              </div>
              <div className="row-between">
                <span className="muted">Provider</span>
                {booking.provider?.user ? (
                  <span className="user-chip">
                    <Avatar user={booking.provider.user} />
                    {booking.provider.user.full_name}
                  </span>
                ) : (
                  <span className="badge badge-warn">Not assigned</span>
                )}
              </div>
            </div>
          </div>

          {isCustomer && (
            <div className="panel">
              <h3>Visitor coming?</h3>
              <p className="muted small">
                Issue a gate pass so security can admit your provider without
                calling you.
              </p>
              <Link to="/gate-passes" className="btn btn-ghost btn-block">
                Issue a gate pass
              </Link>
            </div>
          )}
        </aside>
      </div>

      {paying && (
        <PayModal
          booking={booking}
          outstanding={outstanding}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false)
            toast.success('Payment sent')
            reload()
          }}
        />
      )}

      {reviewing && (
        <ReviewModal
          bookingId={bookingId}
          onClose={() => setReviewing(false)}
          onSaved={() => {
            setReviewing(false)
            toast.success('Thanks for the review')
            reload()
          }}
        />
      )}
    </>
  )
}

function PayModal({ booking, outstanding, onClose, onPaid }) {
  const [form, setForm] = useState({
    amount: String(outstanding),
    payment_method: 'mpesa',
  })
  const { run, pending, error } = useAction()

  return (
    <Modal title={`Pay for ${booking.service?.name}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              payments.pay({
                booking_id: booking.booking_id,
                amount: form.amount || null,
                payment_method: form.payment_method,
              }),
            onPaid
          )
        }}
      >
        <Field
          label="Amount (KES)"
          type="number"
          min="1"
          max={outstanding}
          step="1"
          value={form.amount}
          hint={`${money(outstanding)} still owing. Part payments are allowed.`}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          required
        />
        <Field
          label="Method"
          as="select"
          value={form.payment_method}
          onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
        >
          <option value="mpesa">M-Pesa</option>
          <option value="card">Card</option>
          <option value="wallet">Wallet balance</option>
          <option value="cash">Cash on completion</option>
        </Field>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Sending…' : 'Pay now'}
        </button>
      </form>
    </Modal>
  )
}

function ReviewModal({ bookingId, onClose, onSaved }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const { run, pending, error } = useAction()

  return (
    <Modal title="How did it go?" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () => reviews.create({ booking_id: bookingId, rating, comment }),
            onSaved
          )
        }}
      >
        <div className="field">
          <span>Rating</span>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <Field
          label="Comment"
          as="textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went well, what could be better?"
        />

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : 'Post review'}
        </button>
      </form>
    </Modal>
  )
}
