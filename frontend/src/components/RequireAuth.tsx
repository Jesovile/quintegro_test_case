import React from 'react'
import { Redirect, Route, RouteProps } from 'react-router-dom'
import { isAuthenticated, loginPath } from '@/lib/auth'

interface RequireAuthProps extends Omit<RouteProps, 'component' | 'render' | 'children'> {
  component: React.ComponentType
}

const RequireAuth: React.FC<RequireAuthProps> = ({ component: Component, ...rest }) => (
  <Route
    {...rest}
    render={({ location }) => (isAuthenticated() ? <Component /> : <Redirect to={loginPath(location)} />)}
  />
)

export default RequireAuth
