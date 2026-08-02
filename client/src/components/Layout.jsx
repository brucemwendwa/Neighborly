import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { notifications } from '../api'
import { Avatar } from './ui'

/**
 * App shell: header, role-aware navigation, and the routed page.
 * <Outlet /> is where React Router renders whichever child route matched.
 *
 * The nav is built from a table rather than a pile of JSX conditionals, so
 * "who can see which link" is one readable list. It is presentation only —
 * the server enforces the same rules, since anyone can edit localStorage.
 */
const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/listings', label: 'Housing' },
  { to: '/moves', label: 'Moving' },
  { to: '/rides', label: 'Commute' },
  { to: '/bookings', label: 'Bookings', auth: true },
  { to: '/gate-passes', label: 'Gate passes', auth: true },
  { to: '/wallet', label: 'Wallet', auth: true },
  { to: '/gate', label: 'Gate desk', roles: ['security', 'admin'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
]

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  // Re-checked on every navigation: cheap (a COUNT query behind a composite
  // index) and keeps the badge honest without websockets or a poll timer.
  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0)
      return
    }
    notifications
      .unreadCount()
      .then((data) => setUnread(data.unread))
      .catch(() => setUnread(0))
  }, [isAuthenticated, location.pathname])

  const visible = NAV.filter((item) => {
    if (item.roles) return isAuthenticated && item.roles.includes(user.role)
    if (item.auth) return isAuthenticated
    return true
  })

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          Jirani<span>Hub</span>
        </NavLink>

        <nav className="app-nav">
          {visible.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-actions">
          {isAuthenticated ? (
            <>
              <NavLink to="/notifications" className="bell" aria-label="Notifications">
                🔔
                {unread > 0 && <span className="bell-count">{unread}</span>}
              </NavLink>
              <NavLink to="/profile" className="user-chip">
                <Avatar user={user} />
                {user.full_name.split(' ')[0]}
              </NavLink>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm">
                Sign in
              </NavLink>
              <NavLink to="/register" className="btn btn-sm">
                Join
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="row-between">
          <p style={{ margin: 0 }}>
            Jirani Hub — services, housing, moving and commuting for your estate.
          </p>
          <small className="muted">Phase 4 project · Flask + React</small>
        </div>
      </footer>
    </div>
  )
}
