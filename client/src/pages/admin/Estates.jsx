import { useState } from 'react'
import { estates } from '../../api'
import { useApi, useAction } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Empty, Field, Modal, Results } from '../../components/ui'

/** The communities every other record is scoped to. */
export default function Estates() {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const { data, loading, error, reload } = useApi(() => estates.list(), [])

  return (
    <>
      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <h2>Estates</h2>
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          Add estate
        </button>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="No estates yet" />}
      >
        <div className="grid">
          {data?.items?.map((estate) => (
            <article key={estate.estate_id} className="card">
              <div className="row-between">
                <h3>{estate.estate_name}</h3>
                <span className="badge">{estate.resident_count} members</span>
              </div>
              <p className="muted">
                {estate.address}, {estate.city}, {estate.country}
              </p>
            </article>
          ))}
        </div>
      </Results>

      {creating && (
        <EstateForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            toast.success('Estate added')
            reload()
          }}
        />
      )}
    </>
  )
}

function EstateForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    estate_name: '',
    address: '',
    city: '',
    country: 'Kenya',
  })
  const { run, pending, error } = useAction()
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title="Add an estate" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => estates.create(form), onSaved)
        }}
      >
        <Field label="Name" name="estate_name" value={form.estate_name} onChange={change} required />
        <Field label="Address" name="address" value={form.address} onChange={change} required />
        <div className="form-row">
          <Field label="City" name="city" value={form.city} onChange={change} required />
          <Field label="Country" name="country" value={form.country} onChange={change} />
        </div>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : 'Add estate'}
        </button>
      </form>
    </Modal>
  )
}
