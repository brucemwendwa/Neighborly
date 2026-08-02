import { useState } from 'react'
import { gatePasses } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, Field, PageHeader, Results, StatusBadge } from '../components/ui'
import { dateTime } from '../utils/format'

/**
 * The gate desk — security and admins only.
 *
 * Two halves: look a code up (GET /api/gate-passes/lookup/<code>) and admit
 * the visitor, or scan the day's expected arrivals. The lookup answers with
 * `admit: true|false` rather than making the guard interpret a status, and
 * it flips an out-of-date pass to `expired` as it reads it.
 */
export default function GateDesk() {
  const toast = useToast()
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const { run, pending, error } = useAction()

  const { data, loading, error: listError, reload } = useApi(
    () => gatePasses.list({ status: 'active', per_page: 50 }),
    []
  )

  const lookup = (e) => {
    e.preventDefault()
    setResult(null)
    run(
      () => gatePasses.lookup(code.trim().toUpperCase()),
      (found) => setResult(found)
    )
  }

  const admit = (pass) =>
    run(
      () => gatePasses.update(pass.gate_pass_id, { status: 'used' }),
      () => {
        toast.success(`${pass.visitor_name} admitted`)
        setResult(null)
        setCode('')
        reload()
      }
    )

  return (
    <>
      <PageHeader
        title="Gate desk"
        description="Check a visitor's code, then admit them. The resident is notified
          automatically when you do."
      />

      <div className="split">
        <section className="panel">
          <h2>Check a code</h2>
          <form className="form" onSubmit={lookup}>
            <Field
              label="Pass code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="GP-A1B2C3D4E5F6"
              className="mono"
              required
            />
            <button type="submit" className="btn" disabled={pending || !code.trim()}>
              {pending ? 'Checking…' : 'Check pass'}
            </button>
          </form>

          {error && <p className="notice" style={{ marginTop: '1rem' }}>{error}</p>}

          {result && (
            <div
              className={`notice ${result.admit ? 'notice-success' : ''}`}
              style={{ marginTop: '1.25rem' }}
            >
              <strong>
                {result.admit ? 'Admit this visitor' : 'Do not admit — pass is not active'}
              </strong>
            </div>
          )}

          {result && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="row-between">
                <h3 style={{ marginBottom: 0 }}>{result.gate_pass.visitor_name}</h3>
                <StatusBadge status={result.gate_pass.status} />
              </div>
              <p className="muted" style={{ marginTop: '0.4rem' }}>
                {result.gate_pass.purpose || 'Visit'} · {result.gate_pass.visitor_phone}
              </p>
              <div className="row" style={{ marginTop: '0.6rem' }}>
                <span className="badge">
                  Expected {dateTime(result.gate_pass.entry_date)}
                </span>
                {result.gate_pass.booking && (
                  <span className="badge badge-info">
                    {result.gate_pass.booking.service?.name} booking
                  </span>
                )}
              </div>
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <span className="muted small">Host:</span>
                <span className="user-chip">
                  <Avatar user={result.gate_pass.host} />
                  {result.gate_pass.host?.full_name}
                </span>
              </div>
              {result.admit && (
                <button
                  type="button"
                  className="btn btn-block"
                  style={{ marginTop: '1rem' }}
                  disabled={pending}
                  onClick={() => admit(result.gate_pass)}
                >
                  Admit visitor
                </button>
              )}
            </div>
          )}
        </section>

        <aside>
          <div className="section-head">
            <h2>Expected today</h2>
          </div>
          <Results
            loading={loading}
            error={listError}
            onRetry={reload}
            items={data?.items}
            empty={<Empty title="No active passes">Nobody is expected right now.</Empty>}
          >
            <div className="list">
              {data?.items?.map((pass) => (
                <div key={pass.gate_pass_id} className="list-item">
                  <div className="stack-sm" style={{ flex: 1 }}>
                    <div className="row-between">
                      <strong>{pass.visitor_name}</strong>
                      <span className="mono small">{pass.qr_code}</span>
                    </div>
                    <small className="muted">
                      {pass.purpose || 'Visit'} · host {pass.host?.full_name} ·{' '}
                      {dateTime(pass.entry_date)}
                    </small>
                    <div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pending}
                        onClick={() => admit(pass)}
                      >
                        Admit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Results>
        </aside>
      </div>
    </>
  )
}
