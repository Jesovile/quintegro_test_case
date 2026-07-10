import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_CURRENT_CART } from '../../graphql/queries'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useCheckout } from '../../context/CheckoutContext'
import { usePaymentAttempt } from '../../hooks/usePaymentAttempt'
import PaymentForm from '../../components/checkout/PaymentForm'

// Payment step (US-401-404). On mount, guards against back-navigation/deep-
// linking to a stale payment form for an order that's already `paid` — see
// tech-design.md §4.4's "required fix". Otherwise wires PaymentForm to the
// usePaymentAttempt state machine and renders the four required states.
const CheckoutPaymentPage: React.FC = () => {
  const history = useHistory()
  const { state: checkoutState, dispatch } = useCheckout()
  const { data, loading, error, refetch } = useQuery(GET_CURRENT_CART)

  const cart = data?.currentCart
  const orderId = cart?.orderId ?? checkoutState.orderId

  const { state: paymentState, submit, reset } = usePaymentAttempt(orderId ?? '')

  useEffect(() => {
    dispatch({ type: 'SET_STEP', step: 'payment' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cart?.orderId && cart.orderId !== checkoutState.orderId) {
      dispatch({ type: 'SET_ORDER_ID', orderId: cart.orderId })
    }
  }, [cart?.orderId, checkoutState.orderId, dispatch])

  // Guard against back-navigation/deep-linking to a stale payment form for an
  // order that's already paid (AC design-review fix, tech-design.md §4.4).
  // `currentCart` only ever returns an order in `created` status (or null),
  // so a `paid` order transitioning out of `created` makes it return null —
  // the same signal as "no cart at all". Distinguish the two using the
  // orderId already known from CheckoutContext: if we have one, the most
  // likely explanation is a just-completed payment, so send the user to its
  // confirmation page instead of a blank screen; with no known orderId at
  // all, there's nothing to pay for, so send them to start checkout over.
  useEffect(() => {
    if (loading || error) return
    if (cart?.status === 'paid' && cart.orderId) {
      history.replace(`/checkout/confirmation/${cart.orderId}`)
    } else if (!cart) {
      history.replace(
        checkoutState.orderId
          ? `/checkout/confirmation/${checkoutState.orderId}`
          : '/checkout/address'
      )
    }
  }, [loading, error, cart, checkoutState.orderId, history])

  useEffect(() => {
    if (paymentState.phase === 'success') {
      history.push(`/checkout/confirmation/${paymentState.order.orderId}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentState])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading your order...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <p className="text-sm font-medium">{error.message}</p>
        <Button className="mt-3" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!cart || cart.status === 'paid' || !orderId) {
    // Redirect handled in the effect above (or cart missing entirely); render
    // nothing meaningful while it happens.
    return null
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Payment</h1>

      {paymentState.phase === 'failure' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="text-sm font-medium">{paymentState.message}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <PaymentForm
          onSubmit={submit}
          disabled={paymentState.phase === 'processing'}
        />
      </div>

      {paymentState.phase === 'failure' && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}

export default CheckoutPaymentPage
