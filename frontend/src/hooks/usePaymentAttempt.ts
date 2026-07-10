import { useCallback, useState } from 'react'
import { useMutation } from '@apollo/client'
import { PAY } from '../graphql/mutations'
import { GET_CURRENT_CART, GET_ORDERS } from '../graphql/queries'

export interface CardInput {
  cardNumber: string
  expiry: string
  cvv: string
  cardholderName: string
}

export interface PaidOrder {
  orderId: string
  status: string
}

export type PaymentAttemptState =
  | { phase: 'entering' }
  | { phase: 'processing' }
  | { phase: 'success'; order: PaidOrder }
  | { phase: 'failure'; message: string; retryable: true }

const GENERIC_NETWORK_FAILURE_MESSAGE = 'Something went wrong processing your payment. Please try again.'
const GENERIC_DECLINE_MESSAGE = 'Payment was declined.'

// Encapsulates the four required payment states (AC-402/403/404) so
// CheckoutPaymentPage/PaymentForm stay declarative. Normalizes both failure
// sources — a GraphQL/network error (chaos 500) and a normal response with
// payment.status === 'failed' (declined card) — into the same `failure`
// phase, satisfying AC-404-5's "same failure UI" requirement with one code
// path. See tech-design.md §6.3.
export function usePaymentAttempt(orderId: string) {
  const [state, setState] = useState<PaymentAttemptState>({ phase: 'entering' })
  // Cross-feature integration-review fix: a successful `pay` moves the order
  // out of `created` status, but Apollo's default cache-first fetchPolicy
  // means the header cart badge (CurrentOrder, GET_CURRENT_CART) and the
  // order-history page (OrderList, GET_ORDERS) would otherwise keep showing
  // the stale pre-payment snapshot until a hard reload — breaking
  // AC-502-1/502-2 and AC-503-1/503-2. Refetching both here (rather than
  // switching every consumer to network-only) keeps the fix localized to the
  // one place a payment can actually change their results.
  const [payMutation] = useMutation(PAY, {
    refetchQueries: [{ query: GET_CURRENT_CART }, { query: GET_ORDERS }]
  })

  const submit = useCallback(
    async (card: CardInput) => {
      setState({ phase: 'processing' })

      // Fresh idempotency key on every call (not once per hook instance) so
      // each explicit retry (AC-404-4) is a genuinely new attempt.
      const idempotencyKey = crypto.randomUUID()

      try {
        const { data } = await payMutation({
          variables: { orderId, idempotencyKey, card }
        })

        const payResult = data?.pay
        if (!payResult) {
          setState({ phase: 'failure', message: GENERIC_NETWORK_FAILURE_MESSAGE, retryable: true })
          return
        }

        if (payResult.payment.status === 'failed') {
          setState({
            phase: 'failure',
            message: payResult.payment.failureReason ?? GENERIC_DECLINE_MESSAGE,
            retryable: true
          })
          return
        }

        setState({ phase: 'success', order: payResult.order })
      } catch (e) {
        setState({ phase: 'failure', message: GENERIC_NETWORK_FAILURE_MESSAGE, retryable: true })
      }
    },
    [orderId, payMutation]
  )

  const reset = useCallback(() => {
    setState({ phase: 'entering' })
  }, [])

  return { state, submit, reset }
}
