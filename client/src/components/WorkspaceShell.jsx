import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { notifications } from '../api'
import { Avatar } from './ui'
import Icon from './Icon'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

/**
 * One shell, every workspace.
 *
 * Rather than a layout component per role — five near-identical files that
 * drift apart the first time anyone touches the topbar — each workspace passes
 * its own nav table and picks a layout:
 *
 *   layout="app"    sticky topbar + desktop sidebar + mobile bottom nav.
 *                   For roles with few destinations (resident, security).
 *   layout="admin"  sticky topbar + desktop sidebar + mobile scroll tabs,
 *                   which fit ten-plus items where a bottom nav caps out at six.
 *
 * `subnav` renders secondary tabs above the page, used by the commute area.
 */

// A nav item matches its own path and anything below it, so /commute stays
// highlighted while you are on /commute/find-ride. `end` opts out, which the
// commute overview tab needs or it would match all of its siblings.
function isActive(pathname, href, end) {
  if (end) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

export default function WorkspaceShell({ nav, layout = 'app', title, subnav }) {
  const { user, logout, isAuthenticated } = useAuth()
  const { resolved } = useTheme()
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

  // Keep every role inside its own workspace: the logo lands on that
  // workspace's first surface, not on the resident home a guard cannot use.
  const homeHref = nav[0]?.href ?? '/home'
  const profileHref = nav.find((item) => item.label === 'Profile')?.href ?? '/profile'

  return (
    <div className={`ws ws-${layout}`}>
      <header className="ws-topbar">
        <div className="ws-topbar-inner">
          <NavLink to={homeHref} className="ws-brand">
            <Logo tone={resolved === 'dark' ? 'light' : 'default'} />
          </NavLink>
          {title && <span className="ws-title">· {title}</span>}

          {user?.estate?.estate_name && (
            <span className="ws-estate">
              {user.estate.estate_name}
              <Icon name="ChevronDown" size={16} />
            </span>
          )}

          <div className="ws-actions">
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <NavLink to="/notifications" className="bell" aria-label="Notifications">
                  <Icon name="Bell" />
                  {unread > 0 && <span className="bell-count">{unread}</span>}
                </NavLink>
                <NavLink to={profileHref} aria-label="Your profile">
                  <Avatar user={user} />
                </NavLink>
                <button type="button" onClick={logout} className="btn btn-ghost btn-sm">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/sign-in" className="btn btn-ghost btn-sm">
                  Sign in
                </NavLink>
                <NavLink to="/sign-up" className="btn btn-sm">
                  Join
                </NavLink>
              </>
            )}
          </div>
        </div>

        {/* Admin workspaces carry too many destinations for a bottom nav, so on
            narrow screens they scroll horizontally under the topbar instead. */}
        {layout === 'admin' && (
          <nav className="ws-scrolltabs" aria-label="Sections">
            {nav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={isActive(location.pathname, item.href, item.end) ? 'active' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <div className="ws-body">
        <nav className="ws-sidebar" aria-label="Workspace">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={isActive(location.pathname, item.href, item.end) ? 'active' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="ws-main">
          {subnav && (
            <nav className="ws-subnav" aria-label="Section">
              {subnav.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={
                    isActive(location.pathname, item.href, item.end) ? 'active' : undefined
                  }
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <Outlet />
        </main>
      </div>

      {layout === 'app' && (
        <nav
          className="ws-bottomnav"
          aria-label="Workspace"
          style={{ '--nav-count': nav.length }}
        >
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={isActive(location.pathname, item.href, item.end) ? 'active' : undefined}
            >
              <span className="ws-bottomnav-icon">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
