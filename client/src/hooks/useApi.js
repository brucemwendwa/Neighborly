import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run an API call and track {data, loading, error} for it.
 *
 * Every list screen needs the same three states, so writing them by hand
 * in each page means three chances to forget the error case.
 *
 *   const { data, loading, error, reload } = useApi(
 *     () => listings.list({ estate_id }), [estate_id]
 *   )
 *
 * `deps` works like useEffect's: the call re-runs when they change.
 * Pass `{ enabled: false }` to hold off until something is ready.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)

  // Keeps the newest fetcher without making it a dependency of the effect —
  // an inline arrow function is a new value on every render, which would
  // otherwise loop forever.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    // If the deps change while a request is in flight, the slower response
    // must not overwrite the newer one.
    let current = true
    setLoading(true)
    setError(null)

    fetcherRef
      .current()
      .then((result) => current && setData(result))
      .catch((err) => current && setError(err.message))
      .finally(() => current && setLoading(false))

    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled])

  return { data, loading, error, reload, setData }
}

/**
 * The write-side counterpart: run a mutation, tracking pending state and
 * surfacing the error message the API sent back.
 *
 *   const { run, pending, error } = useAction()
 *   <button onClick={() => run(() => bookings.accept(id), reload)} />
 */
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (action, onSuccess) => {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      await onSuccess?.(result)
      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setPending(false)
    }
  }, [])

  return { run, pending, error, setError }
}
