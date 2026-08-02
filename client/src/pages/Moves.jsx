import { useState } from 'react'
import { moves } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, Field, Modal, PageHeader, Pagination, Results } from '../components/ui'
import { MoveCard } from '../components/cards'
import { toApiDate } from '../utils/format'

/**
 * Moving: request a truck and crew, and (for providers) see open jobs.
 *
 * A move has its own status track, separate from bookings:
 *   pending -> assigned -> in_progress -> completed
 * The requester can cancel; only a provider or admin moves it forward.
 */
export default function Moves() {
  const { isProvider, isAdmin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('mine')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const { run, pending } = useAction()

  const { data, loading, error, reload } = useApi(
    () => (tab === 'open' ? moves.list({ open: true, page }) : moves.list({ page })),
    [tab, page]
  )

  const act = (action, message) =>
    run(action, () => {
      toast.success(message)
      reload()
    })

  return (
    <>
      <PageHeader
        title="Moving"
        description="One request covers the truck, the loaders and the packing. Track it
          from pending through to completed."
      >
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          Request a move
        </button>
      </PageHeader>

      {(isProvider || isAdmin) && (
        <div className="tabs">
          {[
            ['mine', 'My moves'],
            ['open', 'Open requests'],
          ].map(([key, text]) => (
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
      )}

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={
          <Empty title={tab === 'open' ? 'No open moves' : 'No move requests yet'}>
            {tab === 'open'
              ? 'Requests from residents will appear here as they come in.'
              : 'Tell us where you are going and when, and we will line up a crew.'}
          </Empty>
        }
      >
        <div className="grid-wide">
          {data?.items?.map((move) => (
            <MoveCard key={move.move_id} move={move}>
              {tab === 'open' && move.status === 'pending' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => moves.update(move.move_id, { status: 'assigned' }),
                      'Move assigned to you'
                    )
                  }
                >
                  Take this job
                </button>
              )}
              {tab === 'open' && move.status === 'assigned' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => moves.update(move.move_id, { status: 'in_progress' }),
                      'Move under way'
                    )
                  }
                >
                  Start move
                </button>
              )}
              {tab === 'open' && move.status === 'in_progress' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => moves.update(move.move_id, { status: 'completed' }),
                      'Move completed'
                    )
                  }
                >
                  Mark complete
                </button>
              )}

              {tab === 'mine' && !['completed', 'cancelled'].includes(move.status) && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => moves.update(move.move_id, { status: 'cancelled' }),
                      'Move cancelled'
                    )
                  }
                >
                  Cancel
                </button>
              )}
            </MoveCard>
          ))}
        </div>
      </Results>

      <Pagination page={data?.page} pages={data?.pages} onChange={setPage} />

      {creating && (
        <MoveForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            toast.success('Move requested')
            setTab('mine')
            reload()
          }}
        />
      )}
    </>
  )
}

function MoveForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    pickup_location: '',
    dropoff_location: '',
    move_date: '',
    service_type: 'all',
    total_amount: '',
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Request a move" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              moves.create({
                ...form,
                move_date: toApiDate(form.move_date),
                total_amount: form.total_amount || 0,
              }),
            onSaved
          )
        }}
      >
        <Field
          label="Moving from"
          name="pickup_location"
          value={form.pickup_location}
          onChange={change}
          placeholder="Greenview Gardens, Block C"
          required
        />
        <Field
          label="Moving to"
          name="dropoff_location"
          value={form.dropoff_location}
          onChange={change}
          placeholder="Kileleshwa, Laikipia Road"
          required
        />
        <Field
          label="Move date"
          type="datetime-local"
          name="move_date"
          value={form.move_date}
          onChange={change}
          required
        />
        <div className="form-row">
          <Field
            label="What do you need?"
            as="select"
            name="service_type"
            value={form.service_type}
            onChange={change}
          >
            <option value="all">Truck, loaders and packers</option>
            <option value="vehicle">Truck only</option>
            <option value="loaders">Loaders only</option>
            <option value="packers">Packers only</option>
          </Field>
          <Field
            label="Budget (KES)"
            type="number"
            min="0"
            step="500"
            name="total_amount"
            hint="Optional — the crew confirms the final figure."
            value={form.total_amount}
            onChange={change}
          />
        </div>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Sending…' : 'Request move'}
        </button>
      </form>
    </Modal>
  )
}
