import { CheckoutStep, Order } from '@/types/order'

export const CHECKOUT_STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'processing', label: 'Processing' }
]

const STEP_SEQUENCE: CheckoutStep[] = ['delivery', 'payment', 'processing', 'success']

export const stepIndex = (step: CheckoutStep): number => STEP_SEQUENCE.indexOf(step)

const getFurthestStep = (order: Order): CheckoutStep | null => {
  switch (order.status) {
    case 'checkout':
      // Payment becomes reachable once delivery details are saved
      return order.deliverySaved ? 'payment' : 'delivery'
    case 'paid':
    case 'processing':
      return 'processing'
    case 'deliver':
      return 'success'
    default:
      return null
  }
}

// Steps the user may open; after payment the earlier steps are closed
export const getAvailableSteps = (order: Order): CheckoutStep[] => {
  const furthest = getFurthestStep(order)
  if (!furthest) {
    return []
  }
  return order.status === 'checkout' ? STEP_SEQUENCE.slice(0, stepIndex(furthest) + 1) : [furthest]
}

// The requested step if it is open, otherwise the furthest open one
export const resolveStep = (order: Order, requested?: string): CheckoutStep | null => {
  const available = getAvailableSteps(order)
  const match = available.find(step => step === requested)
  return match ?? available[available.length - 1] ?? null
}

export const checkoutPath = (orderId: string, step?: CheckoutStep): string =>
  step ? `/checkout/${orderId}/${step}` : `/checkout/${orderId}`
