import { useState } from 'react'
import { providers } from '../../api'
import { useApi, useAction } from '../../hooks/useApi'
import { useToast } from '../../context/ToastContext'
import { Empty, Field, Results } from '../../components/ui'
import { ProviderCard } from '../../components/cards'

/**
 * The approval queue — the platform's trust model in one screen.
 *
 * Two flags, deliberately separate: `is_verified` means the documents were
 * checked, `is_approved` means they may take jobs. A provider can be
 * verified but suspended, so one boolean would not do.
 */
export default function ProviderQueue() {
  const toast = useToast()
  const [approved, setApproved] = useState('false')
  const { run, pending } = useAction()
  const { data, loading, error, reload } = useApi(
    () => providers.list({ approved, per_page: 50 }),
    [approved]
  )

  const set = (provider, changes, message) =>
    run(
      () => providers.setVerification(provider.provider_id, changes),
      () => {
        toast.success(message)
        reload()
      }
    )

  return (
    <>
      <div className="filters">
        <Field
          label="Show"
          as="select"
          value={approved}
          onChange={(e) => setApproved(e.target.value)}
        >
          <option value="false">Awaiting approval</option>
          <option value="true">Approved</option>
        </Field>
      </div>

      <Results
        loading={loading}
        error={error}
        onRetry={reload}
        items={data?.items}
        empty={<Empty title="Nothing in this queue" />}
      >
        <div className="grid-2">
          {data?.items?.map((provider) => (
            <ProviderCard
              key={provider.provider_id}
              provider={provider}
              action={
                <>
                  {!provider.is_verified && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_verified: true }, 'Marked verified')
                      }
                    >
                      Mark verified
                    </button>
                  )}
                  {provider.is_approved ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_approved: false }, 'Provider suspended')
                      }
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={pending}
                      onClick={() =>
                        set(provider, { is_approved: true }, 'Provider approved')
                      }
                    >
                      Approve
                    </button>
                  )}
                </>
              }
            />
          ))}
        </div>
      </Results>
    </>
  )
}
