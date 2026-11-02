import { describe, expect, it } from 'vitest'
import { loginPath, safeRedirectPath } from './auth'

describe('login redirect', () => {
  it('keeps the requested path', () => {
    expect(loginPath({ pathname: '/checkout/order-2/delivery', search: '' })).toBe('/login?redirect=%2Fcheckout%2Forder-2%2Fdelivery')
  })

  it('allows only paths inside the app', () => {
    expect(safeRedirectPath('/checkout/order-2')).toBe('/checkout/order-2')
    expect(safeRedirectPath('//evil.example')).toBe('/')
    expect(safeRedirectPath('https://evil.example')).toBe('/')
    expect(safeRedirectPath(null)).toBe('/')
  })
})

describe('session rejection', () => {
  it('notifies subscribers until they unsubscribe', async () => {
    const { notifyUnauthenticated, onUnauthenticated } = await import('./auth')
    let calls = 0
    const unsubscribe = onUnauthenticated(() => {
      calls += 1
    })

    notifyUnauthenticated()
    unsubscribe()
    notifyUnauthenticated()

    expect(calls).toBe(1)
  })
})
