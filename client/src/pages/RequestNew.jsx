import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { categories, requests } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { Field, PageHeader } from '../components/ui'

/**
 * Post a job for quotes.
 *
 * The catalogue asks "which service do you want"; this asks "what is wrong".
 * A resident with a leaking tap does not necessarily know whether that is
 * plumbing or general repair, so a category is enough — providers filter on
 * it, and the price comes from whatever they quote.
 */
export default function RequestNew() {
  const navigate = useNavigate()
  const toast = useToast()
  const { run, pending, error } = useAction()
  const { data: cats, loading: loadingCats } = useApi(() => categories.list(), [])

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    budget_min: '',
    budget_max: '',
    scheduled_for: '',
  })

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    // Empty strings would fail the decimal and datetime fields; the API
    // treats these as genuinely optional, so send nothing rather than "".
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== ''),
    )
    await run(
      () => requests.create(payload),
      (result) => {
        toast.success('Request posted — providers can now quote.')
        navigate(`/requests/${result.request.request_id}`, { replace: true })
      },
    )
  }

  return (
    <>
      <PageHeader
        title="Post a request"
        description="Describe the job. Providers in your estate quote, and you choose."
      />

      <form onSubmit={submit} className="form panel">
        {error && <p className="notice">{error}</p>}

        <Field
          label="What do you need?"
          name="title"
          value={form.title}
          onChange={change}
          placeholder="Leaking kitchen tap"
          required
          minLength={3}
          maxLength={140}
        />

        <Field
          label="Details"
          hint="When it started, what you have already tried, anything a provider should bring."
          as="textarea"
          name="description"
          value={form.description}
          onChange={change}
        />

        <label className="field">
          <span>Category</span>
          <select
            name="category_id"
            value={form.category_id}
            onChange={change}
            required
            disabled={loadingCats}
          >
            <option value="">Choose a category…</option>
            {cats?.items?.map((category) => (
              <option key={category.category_id} value={category.category_id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <Field
            label="Budget from (KES)"
            hint="Optional — a range helps providers pitch sensibly."
            type="number"
            min="0"
            name="budget_min"
            value={form.budget_min}
            onChange={change}
          />
          <Field
            label="Budget up to (KES)"
            type="number"
            min="0"
            name="budget_max"
            value={form.budget_max}
            onChange={change}
          />
        </div>

        <Field
          label="Preferred date"
          hint="Optional."
          type="datetime-local"
          name="scheduled_for"
          value={form.scheduled_for}
          onChange={change}
        />

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Posting…' : 'Post request'}
        </button>
      </form>
    </>
  )
}
