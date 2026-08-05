import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { requests } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  Avatar,
  Empty,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  Stars,
  StatusBadge,
} from '../components/ui'
import { money, relative } from '../utils/format'

/**
 * One request, from both sides of the marketplace.
 *
 * The resident sees the quotes and picks one. A provider sees the job and the
 * form to bid on it. Rather than two pages that would drift apart, it is one
 * page that asks who is looking — the underlying record is the same, and so
 * is most of what it shows.
 */
export default function RequestDetail() {
  const { requestId } = useParams()
  const { user, isProvider } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, loading, error, reload } = useApi(
    () => requests.get(requestId),
    [requestId],
  )
  const { run, pending, error: actionError } = useAction()

  if (loading) return <Loading rows={3} />
  if (error) return <ErrorNote error={error} onRetry={reload} />

  const request = data.request
  const isMine = request.resident_id === user.user_id
  const isOpen = request.status === 'open' || request.status === 'quoting'
  const myQuote = request.quotes?.find((q) => q.provider?.user?.user_id === user.user_id)

  const accept = (quote) =>
    run(
      () => requests.acceptQuote(requestId, quote.quote_id),
      (result) => {
        toast.success('Quote accepted — the job is now in your bookings.')
        navigate(`/bookings/${result.booking_id}`)
      },
    )

  const cancel = () =>
    run(() => requests.cancel(requestId), () => {
      toast.success('Request withdrawn.')
      reload()
    })

  return (
    <>
      <PageHeader title={request.title} description={request.description}>
        <StatusBadge status={request.status} />
      </PageHeader>

      {actionError && <p className="notice">{actionError}</p>}

      <div className="split">
        <section className="stack">
          <div className="card">
            <div className="row-between">
              <div>
                <h3>Budget</h3>
                <p className="muted">
                  {request.budget_min || request.budget_max
                    ? `${money(request.budget_min ?? 0)} – ${money(request.budget_max ?? 0)}`
                    : 'No budget given'}
                </p>
              </div>
              <div>
                <h3>Posted</h3>
                <p className="muted">{relative(request.created_at)}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>
                Quotes{' '}
                <span className="muted small">({request.quote_count})</span>
              </h2>
            </div>

            {request.quotes?.length ? (
              <div className="list">
                {request.quotes.map((quote) => (
                  <article key={quote.quote_id} className="list-item">
                    <Avatar user={quote.provider?.user} />
                    <div className="stack-sm" style={{ flex: 1 }}>
                      <div className="row-between">
                        <strong>{quote.provider?.user?.full_name ?? 'Provider'}</strong>
                        <span className="num" style={{ fontSize: '1.1rem' }}>
                          {money(quote.amount)}
                        </span>
                      </div>

                      <div className="row">
                        <StatusBadge status={quote.status} />
                        {quote.eta_minutes && (
                          <span className="badge">
                            can start in {quote.eta_minutes} min
                          </span>
                        )}
                        {quote.provider?.rating != null && (
                          <Stars value={quote.provider.rating} />
                        )}
                      </div>

                      {quote.message && <small>{quote.message}</small>}

                      {/* Only the resident who posted it can accept, and only
                          while the request is still open. */}
                      {isMine && isOpen && quote.status === 'pending' && (
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={pending}
                            onClick={() => accept(quote)}
                          >
                            Accept {money(quote.amount)}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="No quotes yet">
                {isMine
                  ? 'Providers in your estate can see this request and will quote shortly.'
                  : 'Nobody has quoted yet — yours would be the first.'}
              </Empty>
            )}
          </div>

          {isProvider && !isMine && isOpen && (
            <QuoteForm
              requestId={requestId}
              existing={myQuote}
              onDone={() => {
                reload()
                toast.success('Quote sent.')
              }}
            />
          )}
        </section>

        <aside className="stack">
          <div className="card">
            <h3>Timeline</h3>
            <div className="list" style={{ marginTop: '0.75rem' }}>
              {request.events?.map((event) => (
                <div key={event.event_id} className="stack-sm">
                  <div className="row-between">
                    <StatusBadge status={event.event_type} />
                    <small className="muted">{relative(event.created_at)}</small>
                  </div>
                  {event.note && <small className="muted">{event.note}</small>}
                </div>
              ))}
            </div>
          </div>

          {request.booking_id && (
            <div className="card">
              <h3>This job is booked</h3>
              <p className="muted">A quote was accepted and became a booking.</p>
              <Link
                to={`/bookings/${request.booking_id}`}
                className="btn btn-sm btn-block"
                style={{ marginTop: '0.75rem' }}
              >
                Open the booking
              </Link>
            </div>
          )}

          {isMine && isOpen && (
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={pending}
              onClick={cancel}
            >
              Withdraw request
            </button>
          )}
        </aside>
      </div>
    </>
  )
}

/** The provider's side: a price, an ETA and a sentence. */
function QuoteForm({ requestId, existing, onDone }) {
  const { run, pending, error } = useAction()
  const [form, setForm] = useState({ amount: '', message: '', eta_minutes: '' })

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== ''),
    )
    await run(() => requests.quote(requestId, payload), onDone)
  }

  // A live bid is edited by withdrawing it first — the API keeps one bid per
  // provider so the resident never sees the same name at two prices.
  if (existing && existing.status === 'pending') {
    return (
      <div className="card">
        <h3>Your quote</h3>
        <p className="muted">
          You quoted {money(existing.amount)}. Withdraw it if you want to re-price.
        </p>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          style={{ marginTop: '0.75rem' }}
          disabled={pending}
          onClick={() => run(() => requests.withdrawQuote(requestId), onDone)}
        >
          Withdraw quote
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h3>Quote for this job</h3>
      {error && <p className="notice">{error}</p>}

      <div className="form-row">
        <Field
          label="Your price (KES)"
          type="number"
          min="1"
          name="amount"
          value={form.amount}
          onChange={change}
          required
        />
        <Field
          label="Can start in (minutes)"
          type="number"
          min="1"
          name="eta_minutes"
          value={form.eta_minutes}
          onChange={change}
        />
      </div>

      <Field
        label="Message"
        hint="What the price covers, or what you need from the resident."
        as="textarea"
        name="message"
        value={form.message}
        onChange={change}
      />

      <button type="submit" className="btn" disabled={pending}>
        {pending ? 'Sending…' : 'Send quote'}
      </button>
    </form>
  )
}
