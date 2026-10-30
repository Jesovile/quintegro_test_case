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

export const isCurrentOrder =(status: OrderStatus): boolean =>
  status === 'created' || status === 'checkout'
