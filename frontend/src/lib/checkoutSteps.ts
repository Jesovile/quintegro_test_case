import { CheckoutStep, Order } from '@/types/order'

export const STEP_LABELS: Record<CheckoutStep, string> = {
  delivery: 'Delivery',
  payment: 'Payment',
  processing: 'Processing',
  success: 'Order placed'
}

// Steps shown in the progress bar; success is the end of the flow, not a step
export const CHECKOUT_STEPS: { id: CheckoutStep; label: string }[] = (['delivery', 'payment', 'processing'] as const).map(id => ({
  id,
  label: STEP_LABELS[id]
}))

// Every step renders its heading with this id; it receives focus when the user moves to the step
export const CHECKOUT_STEP_HEADING_ID = 'checkout-step-title'

export type StepChangeReaction = 'focus' | 'announce' | 'none'

// What to do when the rendered step changes:
// - the user moved (saved, paid, followed a link) or focus was lost on <body> (arrival, a removed control): focus the new heading;
// - the server moved the order (polling): announce it without taking focus away from what the user is doing.
export const reactToStepChange = (
  previous: CheckoutStep | null,
  current: CheckoutStep,
  { userNavigated, focusLost }: { userNavigated: boolean; focusLost: boolean }
): StepChangeReaction => {
  if (previous === current) {
    return 'none'
  }
  if (focusLost || (previous !== null && userNavigated)) {
    return 'focus'
  }
  return previous === null ? 'none' : 'announce'
}

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
