import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { RESIDENT_NAV, COMMUTE_SUBNAV, SECURITY_NAV, PLATFORM_NAV } from './config/nav'
import PublicLayout from './components/PublicLayout'
import AuthLayout from './components/AuthLayout'
import WorkspaceShell from './components/WorkspaceShell'
import ProtectedRoute from './components/ProtectedRoute'

import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Bookings from './pages/Bookings'
import BookingDetail from './pages/BookingDetail'
import Listings from './pages/Listings'
import ListingDetail from './pages/ListingDetail'
import Moves from './pages/Moves'
import Rides from './pages/Rides'
import GatePasses from './pages/GatePasses'
import GateDesk from './pages/GateDesk'
import Wallet from './pages/Wallet'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

import Overview from './pages/admin/Overview'
import ProviderQueue from './pages/admin/ProviderQueue'
import ListingQueue from './pages/admin/ListingQueue'
import Catalogue from './pages/admin/Catalogue'
import People from './pages/admin/People'
import Estates from './pages/admin/Estates'

/**
 * Route table for the whole app, grouped into workspaces.
 *
 * Each group is a layout route: everything nested under it renders inside that
 * layout's <Outlet />, so a whole role shares one shell without any page
 * having to know which shell it is in.
 *
 *   public     the landing page — marketing header, no workspace nav
 *   auth       sign in / sign up — split-screen brand panel
 *   resident   the default workspace: services, housing, wallet, bookings
 *   commute    the same shell plus commute sub-tabs
 *   security   what a guard on the gate needs, and nothing else
 *   admin      sidebar on desktop, scroll tabs on mobile
 *
 * Resident features keep clean root URLs; every other workspace namespaces
 * itself (/commute, /security, /admin), so no two groups can resolve the same
 * path. Browsing surfaces (services, housing, commute) are deliberately left
 * unprotected — a visitor can look before joining, exactly as before. Anything
 * that reads or writes personal data is wrapped in <ProtectedRoute>, which
 * additionally takes `roles` where the screen only means something to some.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* --- Public ------------------------------------------------ */}
              <Route element={<PublicLayout />}>
                <Route index element={<Landing />} />
              </Route>

              {/* --- Auth -------------------------------------------------- */}
              <Route element={<AuthLayout />}>
                <Route path="sign-in" element={<Login />} />
                <Route path="sign-up" element={<Register />} />
              </Route>

              {/* --- Resident workspace ------------------------------------ */}
              <Route element={<WorkspaceShell nav={RESIDENT_NAV} />}>
                <Route
                  path="home"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="services" element={<Services />} />
                <Route path="services/:serviceId" element={<ServiceDetail />} />
                <Route path="find-and-move" element={<Listings />} />
                <Route path="find-and-move/moving" element={<Moves />} />
                <Route path="find-and-move/:listingId" element={<ListingDetail />} />
                <Route
                  path="bookings"
                  element={
                    <ProtectedRoute>
                      <Bookings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="bookings/:bookingId"
                  element={
                    <ProtectedRoute>
                      <BookingDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="gate-passes"
                  element={
                    <ProtectedRoute>
                      <GatePasses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="wallet"
                  element={
                    <ProtectedRoute>
                      <Wallet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* --- Commute workspace ------------------------------------- */}
              <Route element={<WorkspaceShell nav={RESIDENT_NAV} subnav={COMMUTE_SUBNAV} />}>
                <Route path="commute" element={<Rides />} />
              </Route>

              {/* --- Security workspace ------------------------------------ */}
              <Route element={<WorkspaceShell nav={SECURITY_NAV} title="Security" />}>
                <Route
                  path="security/scan"
                  element={
                    <ProtectedRoute roles={['security', 'admin']}>
                      <GateDesk />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="security/profile"
                  element={
                    <ProtectedRoute roles={['security', 'admin']}>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* --- Platform admin workspace ------------------------------ */}
              <Route
                element={<WorkspaceShell nav={PLATFORM_NAV} layout="admin" title="Admin" />}
              >
                {[
                  ['overview', Overview],
                  ['estates', Estates],
                  ['users', People],
                  ['providers', ProviderQueue],
                  ['listings', ListingQueue],
                  ['services', Catalogue],
                ].map(([slug, Page]) => (
                  <Route
                    key={slug}
                    path={`admin/${slug}`}
                    element={
                      <ProtectedRoute roles={['admin']}>
                        <Page />
                      </ProtectedRoute>
                    }
                  />
                ))}
              </Route>

              {/* --- Redirects from the pre-workspace URLs ------------------
                  The README and WALKTHROUGH still cite these, and anyone with a
                  bookmark should land somewhere useful rather than on a 404. */}
              <Route path="login" element={<Navigate to="/sign-in" replace />} />
              <Route path="register" element={<Navigate to="/sign-up" replace />} />
              <Route path="listings" element={<Navigate to="/find-and-move" replace />} />
              <Route
                path="listings/:listingId"
                element={<Navigate to="/find-and-move" replace />}
              />
              <Route path="moves" element={<Navigate to="/find-and-move/moving" replace />} />
              <Route path="rides" element={<Navigate to="/commute" replace />} />
              <Route path="gate" element={<Navigate to="/security/scan" replace />} />
              <Route path="admin" element={<Navigate to="/admin/overview" replace />} />

              <Route element={<PublicLayout />}>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
