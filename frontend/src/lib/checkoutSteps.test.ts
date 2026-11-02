import { describe, expect, it } from 'vitest'
import { getAvailableSteps, resolveStep } from './checkoutSteps'
import { Order, OrderStatus } from '@/types/order'

const orderIn = (status: OrderStatus, deliverySaved = false): Order => ({
  orderId: 'order-2',
  status,
  products: [],
  promo: null,
  totals: { subtotal: 0, discount: 0, total: 0, currency: 'USD' },
  deliverySaved,
  promoActive: false,
  processingFailed: false
})

describe('checkout steps', () => {
  it('opens only the delivery step right after checkout starts', () => {
    expect(getAvailableSteps(orderIn('checkout'))).toEqual(['delivery'])
  })

  it('sends a step that is not reached yet to the furthest open step (AC-1.4)', () => {
    expect(resolveStep(orderIn('checkout'), 'payment')).toBe('delivery')
    expect(resolveStep(orderIn('checkout'), 'unknown')).toBe('delivery')
    expect(resolveStep(orderIn('checkout'))).toBe('delivery')
  })

  it('opens payment once delivery is saved and keeps delivery reachable (AC-1.5)', () => {
    const order = orderIn('checkout', true)

    expect(getAvailableSteps(order)).toEqual(['delivery', 'payment'])
    expect(resolveStep(order)).toBe('payment')
    expect(resolveStep(order, 'delivery')).toBe('delivery')
    expect(resolveStep(order, 'processing')).toBe('payment')
  })

  it('closes delivery and payment after payment (AC-1.7)', () => {
    expect(getAvailableSteps(orderIn('paid', true))).toEqual(['processing'])
    expect(resolveStep(orderIn('processing', true), 'delivery')).toBe('processing')
  })

  it('keeps the processing step for a failed job so Retry and Cancel can be shown (AC-4.4)', () => {
    const failed = { ...orderIn('processing', true), processingFailed: true }

    expect(resolveStep(failed)).toBe('processing')
    expect(resolveStep(failed, 'success')).toBe('processing')
    expect(resolveStep(failed, 'payment')).toBe('processing')
  })

  it('opens processing for a paid order and success only after deliver (AC-4.1, AC-4.2)', () => {
    expect(resolveStep(orderIn('paid', true))).toBe('processing')
    expect(resolveStep(orderIn('processing', true), 'success')).toBe('processing')
    expect(resolveStep(orderIn('deliver', true))).toBe('success')
  })

  it('does not let the Back button leave the success page for earlier steps (AC-4.5)', () => {
    const done = orderIn('deliver', true)

    expect(getAvailableSteps(done)).toEqual(['success'])
    for (const step of ['delivery', 'payment', 'processing']) {
      expect(resolveStep(done, step)).toBe('success')
    }
  })

  it('shows success for a delivered order', () => {
    expect(resolveStep(orderIn('deliver'), 'payment')).toBe('success')
  })

  it.each<OrderStatus>(['created', 'cancelled'])('has no steps for a %s order', (status) => {
    expect(resolveStep(orderIn(status))).toBeNull()
  })
})
