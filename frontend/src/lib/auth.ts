const AUTH_TOKEN_KEY = 'auth_token'

export const getToken = (): string | null => localStorage.getItem(AUTH_TOKEN_KEY)

export const setToken = (token: string): void => localStorage.setItem(AUTH_TOKEN_KEY, token)

export const clearToken =(): void => localStorage.removeItem(AUTH_TOKEN_KEY)

export const isAuthenticated = (): boolean => !!getToken()

export const loginPath = (location: { pathname: string; search: string }): string =>
  `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`

// Only same-app paths are allowed, so the redirect cannot send the user to another site
export const safeRedirectPath = (redirect: string | null): string =>
  redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'

type Listener = () => void
const unauthenticatedListeners = new Set<Listener>()

// The Apollo link reports a rejected session; the router-aware component performs the redirect
export const onUnauthenticated = (listener: Listener): (() => void) => {
  unauthenticatedListeners.add(listener)
  return () => {
    unauthenticatedListeners.delete(listener)
  }
}

export const notifyUnauthenticated = (): void => {
  unauthenticatedListeners.forEach(listener => listener())
}
