import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
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
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'

/**
 * Route table for the whole app.
 *
 * Everything nested under the <Layout> route renders inside its <Outlet />,
 * so the header and footer are shared across pages.
 *
 * Public routes are the shop window — the catalogue, housing and the sign-in
 * pages. Anything that reads or writes personal data is wrapped in
 * <ProtectedRoute>, which additionally takes `roles` where the screen is
 * only meaningful to some of them (the gate desk, the admin console).
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />

              {/* Public */}
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="services" element={<Services />} />
              <Route path="services/:serviceId" element={<ServiceDetail />} />
              <Route path="listings" element={<Listings />} />
              <Route path="listings/:listingId" element={<ListingDetail />} />

              {/* Signed in */}
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
                path="moves"
                element={
                  <ProtectedRoute>
                    <Moves />
                  </ProtectedRoute>
                }
              />
              <Route
                path="rides"
                element={
                  <ProtectedRoute>
                    <Rides />
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

              {/* Role-restricted */}
              <Route
                path="gate"
                element={
                  <ProtectedRoute roles={['security', 'admin']}>
                    <GateDesk />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
