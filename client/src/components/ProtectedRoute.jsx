import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wrap any route that requires a signed-in user.
 * Pass `roles` to additionally restrict by role, e.g.
 *   <ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>
 *
 * Note: this is a UX guard only. The server must enforce the same rules —
 * anyone can edit localStorage.
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
