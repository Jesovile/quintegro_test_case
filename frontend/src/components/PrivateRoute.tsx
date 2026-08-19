import React from 'react'
import { Route, Redirect, RouteProps } from 'react-router-dom'

const PrivateRoute: React.FC<RouteProps> = ({ component: Component, ...rest }) => {
  const isAuthenticated = !!localStorage.getItem('auth_token')

  if (!Component) {
    return null
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        isAuthenticated ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  )
}

export default PrivateRoute
