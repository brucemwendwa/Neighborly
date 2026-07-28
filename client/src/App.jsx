import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

/**
 * Route table for the whole app.
 *
 * Everything nested under the <Layout> route renders inside its <Outlet />,
 * so the header and footer are shared across pages. Add new features as
 * sibling <Route>s.
 *
 * To require sign-in, wrap the element:
 *   <Route path="wallet" element={
 *     <ProtectedRoute><Wallet /></ProtectedRoute>
 *   } />
 */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
