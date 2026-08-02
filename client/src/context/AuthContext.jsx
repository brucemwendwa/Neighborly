import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { auth } from '../api'

/**
 * Holds the signed-in user for the whole app.
 *
 * Two pieces of state, deliberately stored differently:
 *   the token  -> localStorage, read back by the axios interceptor in
 *                 api/client.js so every request carries it
 *   the user   -> React state (mirrored to localStorage) because the UI
 *                 re-renders when it changes
 *
 * On boot the stored user is trusted just long enough to paint the first
 * frame, then GET /api/auth/me confirms the token is still valid. That
 * avoids a flash of the signed-out header on every refresh while still
 * catching an expired or revoked session.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  const persist = useCallback((token, nextUser, refreshToken) => {
    if (token) localStorage.setItem('token', token)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(nextUser))
    setUser(nextUser)
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  // Confirm the stored token still works, once, at startup.
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setReady(true)
      return
    }
    auth
      .me()
      .then((data) => persist(null, data.user))
      .catch(() => clear())
      .finally(() => setReady(true))
  }, [persist, clear])

  const login = useCallback(
    async (credentials) => {
      setLoading(true)
      try {
        const data = await auth.login(credentials)
        persist(data.token, data.user, data.refresh_token)
        return data.user
      } finally {
        setLoading(false)
      }
    },
    [persist]
  )

  const register = useCallback(
    async (payload) => {
      setLoading(true)
      try {
        const data = await auth.register(payload)
        persist(data.token, data.user, data.refresh_token)
        return data.user
      } finally {
        setLoading(false)
      }
    },
    [persist]
  )

  const logout = useCallback(() => {
    // Fire and forget: the endpoint exists so a token denylist can be
    // added server-side later without the frontend changing.
    auth.logout().catch(() => {})
    clear()
  }, [clear])

  /** Re-read the user after a profile change elsewhere in the app. */
  const refreshUser = useCallback(async () => {
    const data = await auth.me()
    persist(null, data.user)
    return data.user
  }, [persist])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        ready,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isProvider: !!user?.provider_profile,
        isSecurity: user?.role === 'security',
      }}
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
