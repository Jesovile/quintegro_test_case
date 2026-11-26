import { describe, expect, it } from 'vitest'
import { formatMoney, fromCents, toCents } from './money'

describe('money', () => {
  it('converts dollars to whole cents without float drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(899.99)).toBe(89999)
    expect(toCents(1349.98)).toBe(134998)
  })

  it('keeps subtotal - discount + delivery exact', () => {
    const subtotal = toCents(899.99) + toCents(599.99) // 149998
    const sumAfterPromo = toCents(1349.98) // from the backend
    const discount = subtotal - sumAfterPromo
    expect(discount).toBe(15000)
    expect(formatMoney(fromCents(sumAfterPromo + toCents(4.99)))).toBe('$1354.97')
  })
})
