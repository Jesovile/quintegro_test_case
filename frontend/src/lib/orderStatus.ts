import { OrderStatus } from '@/types/order'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: 'Created',
  checkout: 'Checkout',
  paid: 'Paid',
  processing: 'Processing',
  deliver: 'Delivery',
  cancelled: 'Cancelled'
}

export const isEditableOrder = (status: OrderStatus): boolean => status === 'created'

// After delivery an order can no longer be cancelled (AC-5.4)
export const canCancel = (status: OrderStatus): boolean =>
  status === 'checkout' || status === 'paid' || status === 'processing'

// A paid order is refunded when it is cancelled
export const isRefundedOnCancel = (status: OrderStatus): boolean => status === 'paid' || status === 'processing'

export const isCurrentOrder =(status: OrderStatus): boolean =>
  status === 'created' || status === 'checkout'
