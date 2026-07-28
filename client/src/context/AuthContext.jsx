import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'

/**
 * Holds the signed-in user for the whole app.
 *
 * The token lives in localStorage (so a refresh keeps you logged in) and is
 * read back by the axios interceptor in api/client.js. This context only
 * holds the *user object* that the UI needs to render.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)

  const persist = (token, nextUser) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(nextUser))
    setUser(nextUser)
  }

  const login = useCallback(async (credentials) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', credentials)
      persist(data.token, data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (payload) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', payload)
      persist(data.token, data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>')
  return ctx
}
