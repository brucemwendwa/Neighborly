import { useState } from 'react'
import { categories, services } from '../../api'
import { useApi, useAction } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Empty, Field, Modal, Results } from '../../components/ui'
import { money } from '../../utils/format'

/** The shared service catalogue: what residents can book, and for how much. */
export default function Catalogue() {
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const { run, pending } = useAction()
  const cats = useApi(() => categories.list(), [])
  const svcs = useApi(() => services.list({ per_page: 100 }), [])

  const removeService = (service) =>
    run(() => services.remove(service.service_id), () => {
      toast.success('Service removed')
      svcs.reload()
    })

  return (
    <>
      <div className="row-between" style={{ marginBottom: '1rem' }}>
        <h2>Services</h2>
        <button type="button" className="btn" onClick={() => setEditing({})}>
          Add service
        </button>
      </div>

      <Results
        loading={svcs.loading}
        error={svcs.error}
        onRetry={svcs.reload}
        items={svcs.data?.items}
        empty={<Empty title="The catalogue is empty" />}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>From</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {svcs.data?.items?.map((service) => (
                <tr key={service.service_id}>
                  <td>{service.name}</td>
                  <td>{service.category?.name}</td>
                  <td>{money(service.base_price)}</td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing(service)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={pending}
                        onClick={() => removeService(service)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Results>

      <div className="section">
        <h2>Categories</h2>
        <div className="grid">
          {cats.data?.items?.map((category) => (
            <article key={category.category_id} className="card">
              <div className="row-between">
                <h3>{category.name}</h3>
                <span className="badge">{category.service_count}</span>
              </div>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
      </div>

      {editing && (
        <ServiceForm
          service={editing}
          categories={cats.data?.items || []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success('Saved')
            svcs.reload()
            cats.reload()
          }}
        />
      )}
    </>
  )
}

function ServiceForm({ service, categories: categoryList, onClose, onSaved }) {
  const isEdit = Boolean(service.service_id)
  const [form, setForm] = useState({
    name: service.name || '',
    category_id: service.category_id || categoryList[0]?.category_id || '',
    description: service.description || '',
    base_price: service.base_price || '',
  })
  const { run, pending, error } = useAction()

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal title={isEdit ? 'Edit service' : 'Add a service'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              isEdit
                ? services.update(service.service_id, form)
                : services.create(form),
            onSaved
          )
        }}
      >
        <Field label="Name" name="name" value={form.name} onChange={change} required />
        <Field
          label="Category"
          as="select"
          name="category_id"
          value={form.category_id}
          onChange={change}
          required
        >
          {categoryList.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
        </Field>
        <Field
          label="Description"
          as="textarea"
          name="description"
          value={form.description}
          onChange={change}
        />
        <Field
          label="Starting price (KES)"
          type="number"
          min="0"
          step="any"
          name="base_price"
          value={form.base_price}
          onChange={change}
          required
        />

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Saving…' : 'Save service'}
        </button>
      </form>
    </Modal>
  )
}
