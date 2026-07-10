import React, { useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'

interface PrivateRouteProps {
  children: React.ReactNode
}

/**
 * Plain auth-gate wrapper (not a `<Route component={...}>` prop-injector).
 * Wraps a `<Route path="/checkout">` rather than being one itself, per
 * tech-design §6.1. Reads `auth_token` from localStorage — no new auth
 * mechanism, matches the existing pattern used across the app.
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const history = useHistory()
  const location = useLocation()

  const token = localStorage.getItem('auth_token')

  useEffect(() => {
    if (!token) {
      history.push({ pathname: '/login', state: { from: location.pathname } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!token) {
    return null
  }

  return <>{children}</>
}

export default PrivateRoute
