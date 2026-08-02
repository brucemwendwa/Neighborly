import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { bookings, providers, services } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Field, Loading, PageHeader, Results } from '../components/ui'
import { ProviderCard } from '../components/cards'
import { money, toApiDate } from '../utils/format'

/**
 * One service, its approved providers, and the booking form.
 *
 * The form posts the minimum the API needs — service_id, and optionally a
 * provider, a date and an agreed price. The customer and the estate come
 * from the token server-side, so they are deliberately absent here.
 */
export default function ServiceDetail() {
  const { serviceId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { run, pending, error: actionError } = useAction()

  const { data, loading, error } = useApi(() => services.get(serviceId), [serviceId])
  const { data: providerData, loading: providersLoading } = useApi(
    () => providers.list({ estate_id: user?.estate_id, per_page: 12 }),
    [user?.estate_id],
    { enabled: isAuthenticated }
  )

  const service = data?.service
  const [form, setForm] = useState({
    booking_type: 'instant',
    scheduled_date: '',
    total_amount: '',
    provider_id: '',
  })

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    run(
      () =>
        bookings.create({
          service_id: serviceId,
          booking_type: form.booking_type,
          provider_id: form.provider_id || null,
          scheduled_date:
            form.booking_type === 'scheduled' ? toApiDate(form.scheduled_date) : null,
          total_amount: form.total_amount || null,
        }),
      (result) => {
        toast.success('Booking requested')
        navigate(`/bookings/${result.booking.booking_id}`)
      }
    )
  }

  if (loading) return <Loading />
  if (error) return <div className="notice">{error}</div>
  if (!service) return null

  return (
    <>
      <PageHeader title={service.name} description={service.description}>
        <span className="badge badge-success">
          From {money(service.base_price)}
        </span>
      </PageHeader>

      <div className="split">
        <section>
          <div className="section-head">
            <h2>Providers in your estate</h2>
          </div>

          {!isAuthenticated ? (
            <div className="empty">
              <h3>Sign in to see providers</h3>
              <p>Providers are listed per estate, so we need to know yours.</p>
              <Link to="/login" className="btn btn-sm">
                Sign in
              </Link>
            </div>
          ) : providersLoading ? (
            <Loading rows={2} />
          ) : (
            <Results
              loading={false}
              items={providerData?.items}
              empty={
                <div className="empty">
                  <h3>No approved providers yet</h3>
                  <p>
                    Send the request anyway — it goes on the open job board and
                    any approved provider in your estate can take it.
                  </p>
                </div>
              }
            >
              <div className="grid-2">
                {providerData?.items?.map((provider) => (
                  <ProviderCard
                    key={provider.provider_id}
                    provider={provider}
                    onPick={(p) =>
                      setForm((f) => ({ ...f, provider_id: p.provider_id }))
                    }
                  />
                ))}
              </div>
            </Results>
          )}
        </section>

        <aside className="panel">
          <h2>Book this service</h2>
          {!isAuthenticated ? (
            <>
              <p className="muted">You need an account to book.</p>
              <Link to="/login" className="btn btn-block">
                Sign in to book
              </Link>
            </>
          ) : (
            <form className="form" onSubmit={submit}>
              <Field
                label="Booking type"
                as="select"
                name="booking_type"
                value={form.booking_type}
                onChange={change}
              >
                <option value="instant">Instant — come as soon as you can</option>
                <option value="scheduled">Scheduled — pick a date and time</option>
                <option value="quotation">Quotation — quote me first</option>
              </Field>

              {form.booking_type === 'scheduled' && (
                <Field
                  label="When"
                  type="datetime-local"
                  name="scheduled_date"
                  value={form.scheduled_date}
                  onChange={change}
                  required
                />
              )}

              <Field
                label="Agreed price (KES)"
                type="number"
                min="0"
                step="any"
                name="total_amount"
                placeholder={String(service.base_price)}
                hint={`Leave blank to use the ${money(service.base_price)} starting price.`}
                value={form.total_amount}
                onChange={change}
              />

              <Field
                label="Provider"
                as="select"
                name="provider_id"
                value={form.provider_id}
                onChange={change}
                hint="Leave as 'any' to post it on the open job board."
              >
                <option value="">Any available provider</option>
                {providerData?.items?.map((provider) => (
                  <option key={provider.provider_id} value={provider.provider_id}>
                    {provider.user?.full_name}
                  </option>
                ))}
              </Field>

              {actionError && <p className="notice">{actionError}</p>}

              <button type="submit" className="btn btn-block" disabled={pending}>
                {pending ? 'Sending…' : 'Request booking'}
              </button>
              <small className="muted">
                Requesting is free. You only pay once the job is accepted.
              </small>
            </form>
          )}
        </aside>
      </div>
    </>
  )
}
