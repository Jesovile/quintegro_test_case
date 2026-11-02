import { describe, expect, it } from 'vitest'
import { formatUsd } from './money'
import { ORDER_STATUS_LABELS, isCurrentOrder } from './orderStatus'
import { OrderStatus } from '@/types/order'

describe('formatUsd (AC-6.3, whole dollars)', () => {
  it('formats the seed prices', () => {
    expect([1300, 900, 200, 600].map(formatUsd)).toEqual(['$1,300', '$900', '$200', '$600'])
  })

  it('formats large totals', () => {
    expect(formatUsd(30000)).toBe('$30,000')
    expect(formatUsd(1234567)).toBe('$1,234,567')
  })

  it('never shows cents', () => {
    expect(formatUsd(1299.99)).toBe('$1,300')
  })
})

describe('order statuses', () => {
  const all: OrderStatus[] = ['created', 'checkout', 'paid', 'processing', 'deliver', 'cancelled']

  it('has a label for exactly the six new statuses', () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...all].sort())
    expect(Object.keys(ORDER_STATUS_LABELS)).not.toContain('submited')
    expect(Object.keys(ORDER_STATUS_LABELS)).not.toContain('finished')
  })

  it.each(['paid', 'processing', 'deliver', 'cancelled'] as OrderStatus[])('%s is history, not current', status => {
    expect(isCurrentOrder(status)).toBe(false)
  })

  it.each(['created', 'checkout'] as OrderStatus[])('%s is current', status => {
    expect(isCurrentOrder(status)).toBe(true)
  })
})
