import React, { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_CURRENT_CART } from '../../graphql/queries'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useCheckout } from '../../context/CheckoutContext'
import OrderReviewSummary from '../../components/checkout/OrderReviewSummary'

// Read-only review step (US-301). No mutation is fired here — all state was
// already committed to the order by feature 2's setDeliveryDetails. The
// rendered total is `currentCart.total`, computed server-side (tech-design.md
// §4.3) — never recomputed client-side.
const CheckoutReviewPage: React.FC = () => {
  const history = useHistory()
  const { dispatch } = useCheckout()
  const { data, loading, error, refetch } = useQuery(GET_CURRENT_CART)

  const cart = data?.currentCart

  useEffect(() => {
    dispatch({ type: 'SET_STEP', step: 'review' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading || error) {
      return
    }
    if (!cart || !cart.deliveryAddress || !cart.deliveryMethod) {
      history.push('/checkout/address')
    }
  }, [loading, error, cart, history])

  const handleConfirm = () => {
    history.push('/checkout/payment')
  }

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

  if (!cart || !cart.deliveryAddress || !cart.deliveryMethod) {
    // Redirect handled in the effect above; render nothing meaningful while it happens.
    return null
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Review your order</h1>

      <OrderReviewSummary
        products={cart.products}
        deliveryAddress={cart.deliveryAddress}
        deliveryMethod={cart.deliveryMethod}
        total={cart.total}
      />

      <div className="mt-6 flex justify-end">
        <Button onClick={handleConfirm}>Confirm and Pay</Button>
      </div>
    </div>
  )
}

export default CheckoutReviewPage
