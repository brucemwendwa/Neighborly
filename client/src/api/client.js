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
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    const message =
      error.response?.data?.error || error.message || 'Something went wrong'
    return Promise.reject(new Error(message))
  }
)

export default api
