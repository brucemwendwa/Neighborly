/**
 * The whole API surface, in one place.
 *
 * Components never build URLs or touch axios directly — they call these
 * functions. Two things fall out of that:
 *   - when an endpoint changes, exactly one file changes
 *   - every call already carries the auth header and shared error handling
 *     from api/client.js
 *
 * Each function returns the response *body*, not the axios envelope, so a
 * component writes `const { items } = await listings.list()`.
 */
import api from './client'

const get = (url, params) => api.get(url, { params }).then((r) => r.data)
const post = (url, body) => api.post(url, body).then((r) => r.data)
const patch = (url, body) => api.patch(url, body).then((r) => r.data)
const del = (url) => api.delete(url).then((r) => r.data)

export const auth = {
  register: (payload) => post('/auth/register', payload),
  login: (credentials) => post('/auth/login', credentials),
  me: () => get('/auth/me'),
  updateMe: (payload) => patch('/auth/me', payload),
  changePassword: (payload) => post('/auth/change-password', payload),
  logout: () => post('/auth/logout'),
}

export const estates = {
  list: (params) => get('/estates', params),
  get: (id) => get(`/estates/${id}`),
  create: (payload) => post('/estates', payload),
  update: (id, payload) => patch(`/estates/${id}`, payload),
  remove: (id) => del(`/estates/${id}`),
}

export const categories = {
  list: () => get('/categories'),
  get: (id) => get(`/categories/${id}`),
  create: (payload) => post('/categories', payload),
  update: (id, payload) => patch(`/categories/${id}`, payload),
  remove: (id) => del(`/categories/${id}`),
}

export const services = {
  list: (params) => get('/services', params),
  get: (id) => get(`/services/${id}`),
  create: (payload) => post('/services', payload),
  update: (id, payload) => patch(`/services/${id}`, payload),
  remove: (id) => del(`/services/${id}`),
}

export const providers = {
  list: (params) => get('/providers', params),
  get: (id) => get(`/providers/${id}`),
  jobs: (id) => get(`/providers/${id}/jobs`),
  me: () => get('/providers/me'),
  createMine: (payload) => post('/providers/me', payload),
  updateMine: (payload) => patch('/providers/me', payload),
  setVerification: (id, payload) => patch(`/providers/${id}/verification`, payload),
}

export const bookings = {
  list: (params) => get('/bookings', params),
  available: (params) => get('/bookings/available', params),
  get: (id) => get(`/bookings/${id}`),
  create: (payload) => post('/bookings', payload),
  accept: (id) => post(`/bookings/${id}/accept`),
  update: (id, payload) => patch(`/bookings/${id}`, payload),
  remove: (id) => del(`/bookings/${id}`),
}

export const payments = {
  list: (params) => get('/payments', params),
  get: (id) => get(`/payments/${id}`),
  pay: (payload) => post('/payments', payload),
  setStatus: (id, payload) => patch(`/payments/${id}`, payload),
}

export const wallet = {
  get: () => get('/wallet'),
  topUp: (payload) => post('/wallet/top-up', payload),
}

export const listings = {
  list: (params) => get('/listings', params),
  mine: (params) => get('/listings/mine', params),
  get: (id) => get(`/listings/${id}`),
  create: (payload) => post('/listings', payload),
  update: (id, payload) => patch(`/listings/${id}`, payload),
  setVerification: (id, payload) => patch(`/listings/${id}/verification`, payload),
  remove: (id) => del(`/listings/${id}`),
}

export const moves = {
  list: (params) => get('/moves', params),
  get: (id) => get(`/moves/${id}`),
  create: (payload) => post('/moves', payload),
  update: (id, payload) => patch(`/moves/${id}`, payload),
  remove: (id) => del(`/moves/${id}`),
  serviceTypes: () => get('/moves/service-types'),
}

export const rides = {
  list: (params) => get('/rides', params),
  mine: () => get('/rides/mine'),
  get: (id) => get(`/rides/${id}`),
  create: (payload) => post('/rides', payload),
  update: (id, payload) => patch(`/rides/${id}`, payload),
  remove: (id) => del(`/rides/${id}`),
  claimSeats: (id, payload) => post(`/rides/${id}/bookings`, payload),
  releaseSeat: (id) => del(`/rides/${id}/bookings/me`),
}

export const gatePasses = {
  list: (params) => get('/gate-passes', params),
  get: (id) => get(`/gate-passes/${id}`),
  create: (payload) => post('/gate-passes', payload),
  update: (id, payload) => patch(`/gate-passes/${id}`, payload),
  remove: (id) => del(`/gate-passes/${id}`),
  lookup: (code) => get(`/gate-passes/lookup/${code}`),
}

export const reviews = {
  list: (params) => get('/reviews', params),
  summary: (userId) => get(`/reviews/summary/${userId}`),
  create: (payload) => post('/reviews', payload),
  update: (id, payload) => patch(`/reviews/${id}`, payload),
  remove: (id) => del(`/reviews/${id}`),
}

export const notifications = {
  list: (params) => get('/notifications', params),
  unreadCount: () => get('/notifications/unread-count'),
  markRead: (id, isRead = true) => patch(`/notifications/${id}`, { is_read: isRead }),
  markAllRead: () => post('/notifications/read-all'),
  remove: (id) => del(`/notifications/${id}`),
  create: (payload) => post('/notifications', payload),
}

export const dashboard = {
  get: () => get('/dashboard'),
  admin: () => get('/dashboard/admin'),
}

export const users = {
  list: (params) => get('/users', params),
  get: (id) => get(`/users/${id}`),
  update: (id, payload) => patch(`/users/${id}`, payload),
  remove: (id) => del(`/users/${id}`),
  roles: () => get('/users/roles'),
}

export const health = () => get('/health')
