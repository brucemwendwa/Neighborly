/**
 * One configured fetch wrapper for the whole app.
 *
 * Import this — never call fetch directly from a component. That way the base
 * URL, the auth header and error handling are defined in exactly one place,
 * and changing them later is a one-file change.
 *
 * Each method resolves to the parsed response *body*, so callers never touch
 * Response objects or repeat `res.json()`.
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

/** Build the query string, skipping anything left undefined or blank. */
function withQuery(path, params) {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, value)
    }
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

/**
 * Turn a failed response into an Error a component can just read `.message`
 * from.
 *
 * Marshmallow answers a failed validation as
 *   {"error": "Validation failed", "details": {"email": ["..."]}}
 * Flattening the first field message makes the common case readable, while
 * `err.details` stays available for per-field display.
 */
function toError(status, data, fallback) {
  let message = data?.error || fallback || 'Something went wrong'
  if (data?.details && typeof data.details === 'object') {
    const first = Object.entries(data.details)[0]
    if (first) {
      const [field, messages] = first
      const text = Array.isArray(messages) ? messages[0] : String(messages)
      message = field === '_schema' ? text : `${field}: ${text}`
    }
  }
  const error = new Error(message)
  error.status = status
  error.details = data?.details
  return error
}

async function request(method, path, { params, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  // Attach the JWT (if we have one) to every outgoing request.
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(BASE_URL + withQuery(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch only rejects when the request never completed — no server, DNS
    // failure, the machine is offline. A 500 is a resolved promise.
    throw new Error('Cannot reach the server. Check your connection.')
  }

  // 204 and friends have no body to parse.
  const text = await response.text()

  // Only our own handlers answer in JSON. A crashed serverless function, a
  // gateway timeout or a proxy's HTML error page all land here as plain text,
  // and an unguarded JSON.parse would surface its own SyntaxError — "Unexpected
  // token 'A'" — as the message on the form, hiding the status that actually
  // explains what went wrong.
  let data = null
  let isJson = true
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      isJson = false
    }
  }

  if (response.ok) {
    if (!isJson) throw new Error('The server sent a response the app could not read.')
    return data
  }

  // 401 means the token is missing, expired or belongs to a deleted account —
  // there is nothing a retry can fix, so drop it and start over. The sign-in
  // page is excluded: a wrong password there must show an error, not reload
  // the page underneath the form.
  if (response.status === 401 && window.location.pathname !== '/sign-in') {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    window.location.href = '/sign-in'
  }

  // A non-JSON body means the request never reached a route handler, so there
  // is no `error` field to read and the status is all we can honestly report.
  const fallback = isJson
    ? response.statusText
    : response.status >= 500
      ? `The server is not responding correctly (${response.status}). Please try again shortly.`
      : `Request failed (${response.status}).`

  throw toError(response.status, data, fallback)
}

const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  delete: (path) => request('DELETE', path),
}

export default api
