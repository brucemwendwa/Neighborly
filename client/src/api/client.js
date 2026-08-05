import axios from 'axios'

/**
 * One configured axios instance for the whole app.
 *
 * Import this — never call axios directly from a component. That way the
 * base URL, the auth header and error handling are defined in exactly one
 * place, and changing them later is a one-file change.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the JWT (if we have one) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normalise errors so components can just read `err.message`,
// and bounce the user out on an expired session.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const data = error.response?.data

    // 401 means the token is missing, expired or belongs to a deleted
    // account — there is nothing a retry can fix, so drop it and start over.
    // The login page is excluded: a wrong password there must show an error,
    // not reload the page underneath the form.
    if (status === 401 && window.location.pathname !== '/sign-in') {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/sign-in'
    }

    // Marshmallow answers a failed validation as
    //   {"error": "Validation failed", "details": {"email": ["..."]}}
    // Flattening the first field message makes the common case readable,
    // while `err.details` stays available for per-field display.
    let message = data?.error || error.message || 'Something went wrong'
    if (data?.details && typeof data.details === 'object') {
      const first = Object.entries(data.details)[0]
      if (first) {
        const [field, messages] = first
        const text = Array.isArray(messages) ? messages[0] : String(messages)
        message = field === '_schema' ? text : `${field}: ${text}`
      }
    }

    const normalised = new Error(message)
    normalised.status = status
    normalised.details = data?.details
    return Promise.reject(normalised)
  }
)

export default api
