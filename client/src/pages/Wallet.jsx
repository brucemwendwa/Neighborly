import { useState } from 'react'
import { payments, wallet } from '../api'
import { useApi, useAction } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  Empty,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Results,
  Stat,
  StatusBadge,
} from '../components/ui'
import { dateTime, label, money } from '../utils/format'

/**
 * Wallet and payment history.
 *
 * The ledger is the point: every deposit, retry and refund is its own row,
 * so "what did I actually pay for this job?" has an answer you can read
 * rather than a single number that was overwritten.
 */
export default function Wallet() {
  const { refreshUser } = useAuth()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [toppingUp, setToppingUp] = useState(false)

  const walletCall = useApi(() => wallet.get(), [])
  const history = useApi(() => payments.list({ page }), [page])

  const balance = walletCall.data?.wallet?.balance
  const items = history.data?.items

  const successful = items?.filter((p) => p.status === 'success') || []
  const spent = successful.reduce((total, p) => total + Number(p.amount), 0)

  return (
    <>
      <PageHeader
        title="Wallet"
        description="Top up once, then pay for bookings without re-entering anything."
      >
        <button type="button" className="btn" onClick={() => setToppingUp(true)}>
          Top up
        </button>
      </PageHeader>

      {walletCall.loading ? (
        <Loading rows={1} />
      ) : walletCall.error ? (
        <div className="notice">{walletCall.error}</div>
      ) : (
        <section className="stats">
          <Stat value={money(balance)} label="Available balance" />
          <Stat value={money(spent)} label="Paid on this page" />
          <Stat value={history.data?.total ?? 0} label="Payments made" />
          <Stat
            value={walletCall.data?.wallet?.currency || 'KES'}
            label="Currency"
          />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Payment history</h2>
        </div>

        <Results
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
          items={items}
          empty={
            <Empty title="No payments yet">
              Pay for a booking and the receipt shows up here.
            </Empty>
          }
        >
          <div className="table-wrap">
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
                {items?.map((payment) => (
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
        </Results>

        <Pagination
          page={history.data?.page}
          pages={history.data?.pages}
          onChange={setPage}
        />
      </section>

      {toppingUp && (
        <TopUpModal
          onClose={() => setToppingUp(false)}
          onSaved={() => {
            setToppingUp(false)
            toast.success('Wallet topped up')
            walletCall.reload()
            history.reload()
            refreshUser().catch(() => {})
          }}
        />
      )}
    </>
  )
}

function TopUpModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '1000', payment_method: 'mpesa' })
  const { run, pending, error } = useAction()

  return (
    <Modal title="Top up your wallet" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => wallet.topUp(form), onSaved)
        }}
      >
        <Field
          label="Amount (KES)"
          type="number"
          min="1"
          step="any"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          required
        />
        <Field
          label="Pay with"
          as="select"
          value={form.payment_method}
          onChange={(e) =>
            setForm((f) => ({ ...f, payment_method: e.target.value }))
          }
        >
          <option value="mpesa">M-Pesa</option>
          <option value="card">Card</option>
          <option value="cash">Cash at the office</option>
        </Field>

        <div className="row" style={{ gap: '0.4rem' }}>
          {[500, 1000, 2500, 5000].map((amount) => (
            <button
              key={amount}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setForm((f) => ({ ...f, amount: String(amount) }))}
            >
              {money(amount)}
            </button>
          ))}
        </div>

        {error && <p className="notice">{error}</p>}

        <button type="submit" className="btn btn-block" disabled={pending}>
          {pending ? 'Adding…' : 'Add funds'}
        </button>
      </form>
    </Modal>
  )
}
