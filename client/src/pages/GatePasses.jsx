import { useState } from 'react'
import { bookings, gatePasses } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { Empty, Field, Modal, PageHeader, Pagination, Results } from '../components/ui'
import { GatePassCard } from '../components/cards'
import { toApiDate } from '../utils/format'

/**
 * Gate passes a resident has issued.
 *
 * The code on each card is the whole mechanism: the visitor shows it, and
 * security looks it up on the gate desk screen. The server mints it — a
 * guessable code would be a way to walk into the estate.
 */
export default function GatePasses() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [issuing, setIssuing] = useState(false)
  const { run, pending } = useAction()

  const { data, loading, error, reload } = useApi(
    () => gatePasses.list({ page, status: status || undefined }),
    [page, status]
  )

  const revoke = (pass) =>
    run(
      () => gatePasses.update(pass.gate_pass_id, { status: 'expired' }),
      () => {
        toast.success('Pass expired')
        reload()
      }
    )

  const remove = (pass) =>
    run(() => gatePasses.remove(pass.gate_pass_id), () => {
      toast.success('Pass deleted')
      reload()
    })

  return (
    <>
      <PageHeader
        title="Gate passes"
        description="Issue a code before your visitor arrives so security can admit them
          without calling you."
      >
        <button type="button" className="btn" onClick={() => setIssuing(true)}>
          Issue a pass
        </button>
      </PageHeader>

      <div className="filters">
        <Field
          label="Status"
          as="select"
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          <option value="">All passes</option>
          <option value="active">Active</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title="No gate passes yet">
            Issue one for a visitor, a delivery or a provider coming to do a job.
          </Empty>
        }
      >
        <div className="grid-wide">
          {data?.items?.map((pass) => (
            <GatePassCard key={pass.gate_pass_id} pass={pass}>
              {pass.status === 'active' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => revoke(pass)}
                >
                  Expire now
                </button>
              )}
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={pending}
                onClick={() => remove(pass)}
              >
                Delete
              </button>
            </GatePassCard>
          ))}
        </div>
      </Results>

      <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />

      {issuing && (
        <GatePassForm
          onClose={() => setIssuing(false)}
          onSaved={() => {
            setIssuing(false)
            toast.success('Gate pass issued')
            reload()
          }}
        />
      )}
    </>
  )
}

function GatePassForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    visitor_name: '',
    visitor_phone: '',
    purpose: '',
    entry_date: '',
    exit_date: '',
    booking_id: '',
  })
  const { run, pending, error } = useAction()

  // Linking a pass to a booking is what lets the guard see "plumber,
  // booking #123" instead of an unexplained name at the gate.
  const { data: bookingData } = useApi(
    () => bookings.list({ as: 'customer', per_page: 20 }),
    []
  )

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Issue a gate pass" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              gatePasses.create({
                ...form,
                booking_id: form.booking_id || null,
                purpose: form.purpose || null,
                entry_date: toApiDate(form.entry_date),
                exit_date: toApiDate(form.exit_date),
              }),
            onSaved
          )
        }}
      >
        <Field
          label="Visitor name"
          name="visitor_name"
          value={form.visitor_name}
          onChange={change}
          required
        />
        <Field
          label="Visitor phone"
          name="visitor_phone"
          placeholder="+254712345678"
          value={form.visitor_phone}
          onChange={change}
          required
        />
        <Field
          label="Purpose"
          name="purpose"
          placeholder="Family visit, delivery, plumbing job…"
          value={form.purpose}
          onChange={change}
        />
        <div className="form-row">
          <Field
            label="Expected arrival"
            type="datetime-local"
            name="entry_date"
            value={form.entry_date}
            onChange={change}
            required
          />
          <Field
            label="Expected departure"
            type="datetime-local"
            name="exit_date"
            hint="After this, the pass reads as expired at the gate."
            value={form.exit_date}
            onChange={change}
          />
        </div>
        <Field
          label="Related booking"
          as="select"
          name="booking_id"
          value={form.booking_id}
          onChange={change}
        >
          <option value="">Not related to a booking</option>
          {bookingData?.items?.map((booking) => (
            <option key={booking.booking_id} value={booking.booking_id}>
              {booking.service?.name} — {booking.provider?.user?.full_name || 'unassigned'}
            </option>
          ))}
        </Field>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Issuing…' : 'Issue pass'}
        </button>
      </form>
    </Modal>
  )
}
