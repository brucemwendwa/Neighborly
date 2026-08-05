import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ROLE_HOME } from '../config/nav'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

/**
 * Chrome for the public pages — the landing page and the catalogue a visitor
 * can browse before signing up.
 *
 * Deliberately not the workspace shell: there is no sidebar and no bottom nav,
 * because a signed-out visitor has no workspace to navigate. The header is a
 * marketing header, and the only two actions that matter are sign in and join.
 */
const PUBLIC_NAV = [
  { to: '/services', label: 'Services' },
  { to: '/find-and-move', label: 'Housing' },
  { to: '/commute', label: 'Commute' },
]

export default function PublicLayout() {
  const { user, isAuthenticated } = useAuth()
  const { resolved } = useTheme()

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="ws-brand">
          <Logo tone={resolved === 'dark' ? 'light' : 'default'} />
        </NavLink>

        <nav className="app-nav">
          {PUBLIC_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-actions">
          <ThemeToggle />
          {isAuthenticated ? (
            // Already signed in and looking at the shop window — the useful
            // action is a way back into their own workspace.
            <NavLink to={ROLE_HOME[user.role] ?? '/home'} className="btn btn-sm">
              Open app
            </NavLink>
          ) : (
            <>
              <NavLink to="/sign-in" className="btn btn-ghost btn-sm">
                Sign in
              </NavLink>
              <NavLink to="/sign-up" className="btn btn-sm">
                Get started
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
