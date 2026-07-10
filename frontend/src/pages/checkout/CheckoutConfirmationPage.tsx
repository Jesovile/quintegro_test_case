import React from 'react'
import { useHistory, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { GET_ORDER } from '../../graphql/queries'
import { Button } from '@/components/ui/button'
import OrderReviewSummary from '../../components/checkout/OrderReviewSummary'

// Feature 5 (implementation-plan-05.md iteration 5.4) — replaces Feature 4's
// temporary stub wholesale. Fires GET_ORDER(orderId) and renders order id,
// purchased items, delivery address, delivery method, and total paid
// (AC-501-1), plus a "My Orders" link (AC-501-2). Reuses OrderReviewSummary's
// read-only rendering approach (tech-design.md §4.5) rather than
// reimplementing the same layout.
const CheckoutConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { data, loading, error, refetch } = useQuery(GET_ORDER, {
    variables: { orderId }
  })

  const order = data?.order

  const handleViewOrders = () => {
    history.push('/order')
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

  // Defensive, not a formal AC: prevents a misleading "confirmation" screen
  // if a user manually edits the URL to an order that never paid (tech-design
  // §4.5 / implementation-plan-05.md iteration 5.4).
  if (!order || order.status !== 'paid' || !order.deliveryAddress || !order.deliveryMethod) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">This order isn't confirmed yet.</h1>
          <p className="mt-2 text-gray-600">Head back to your orders to check its status.</p>
          <Button className="mt-6" onClick={handleViewOrders}>
            Back to your orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Payment successful!</h1>
        <p className="mt-2 text-gray-600">Order #{order.orderId} is confirmed.</p>
      </div>

      <OrderReviewSummary
        products={order.products}
        deliveryAddress={order.deliveryAddress}
        deliveryMethod={order.deliveryMethod}
        total={order.total}
      />

      <div className="mt-6 flex justify-center">
        <Button onClick={handleViewOrders}>My Orders</Button>
      </div>
    </div>
  )
}

export default CheckoutConfirmationPage
