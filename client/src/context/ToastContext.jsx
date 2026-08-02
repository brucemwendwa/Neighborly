import { createContext, useCallback, useContext, useState } from 'react'

/**
 * Short confirmations in the corner: "Booking accepted", "Payment sent".
 *
 * Actions that change data need to say so somewhere, and putting the
 * message next to every button means every button reinvents it. One
 * provider, one call:
 *
 *   const toast = useToast()
 *   toast.success('Seat claimed')
 *   toast.error(err.message)
 */
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, tone = 'default') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const value = {
    push,
    success: useCallback((message) => push(message, 'success'), [push]),
    error: useCallback((message) => push(message, 'error'), [push]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside a <ToastProvider>')
  return ctx
}
