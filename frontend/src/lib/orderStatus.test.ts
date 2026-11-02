import { describe, expect, it } from 'vitest'
import { ORDER_STATUS_LABELS, isCurrentOrder, isEditableOrder } from './orderStatus'
import { OrderStatus } from '@/types/order'

describe('isEditableOrder (AC-6.1)', () => {
  it('allows editing only in created', () => {
    const statuses = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]

    expect(statuses.filter(isEditableOrder)).toEqual(['created'])
  })
})

describe('isCurrentOrder', () => {
  it('treats created and checkout as current', () => {
    const statuses = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]

    expect(statuses.filter(isCurrentOrder)).toEqual(['created', 'checkout'])
  })
})

describe('canCancel (AC-5.4, AC-7.3)', () => {
  it('allows cancelling from checkout until delivery and refunds only paid orders', async () => {
    const { canCancel, isRefundedOnCancel } = await import('./orderStatus')
    const statuses = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]

    expect(statuses.filter(canCancel)).toEqual(['checkout', 'paid', 'processing'])
    expect(statuses.filter(isRefundedOnCancel)).toEqual(['paid', 'processing'])
  })
})
