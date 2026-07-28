import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * App shell: header + nav + the routed page.
 * <Outlet /> is where React Router renders whichever child route matched.
 */
export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          Jirani<span>Hub</span>
        </NavLink>

        <nav className="app-nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/services">Services</NavLink>
          <NavLink to="/listings">Housing</NavLink>
          <NavLink to="/rides">Commute</NavLink>
        </nav>

        <div className="app-actions">
          {isAuthenticated ? (
            <>
              <span className="user-chip">{user.full_name}</span>
              <button type="button" onClick={logout} className="btn btn-ghost">
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn">
              Sign in
            </NavLink>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>Jirani Hub — services, housing and commuting for your estate.</p>
      </footer>
    </div>
  )
}
