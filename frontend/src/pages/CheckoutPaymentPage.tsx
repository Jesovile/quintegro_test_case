import React from 'react'
import { useParams, Redirect } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { GET_ORDER } from '@/graphql/queries'
import { Card, CardContent } from '@/components/ui/card'
import CheckoutStepper from '@/components/checkout/CheckoutStepper'
import PaymentStep from '@/components/checkout/PaymentStep'

interface RouteParams {
  orderId: string
}

const DELIVERY_LABELS: Record<string, string> = {
  fast: 'Fast',
  super_fast: 'Super Fast',
  extra_fast: 'Extra Fast',
}

const CheckoutPaymentPage: React.FC = () => {
  const { orderId } = useParams<RouteParams>()

  const { data, loading, error } = useQuery(GET_ORDER, {
    variables: { orderId },
    fetchPolicy: 'network-only',
  })

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !data?.order) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error?.message ?? 'Order not found'}
        </div>
      </div>
    )
  }

  const order = data.order
  if (order.status !== 'created') {
    return <Redirect to={`/checkout/${orderId}/processing`} />
  }
  if (!order.deliveryAddress || !order.invoiceAddress) {
    return <Redirect to={`/checkout/${orderId}/delivery`} />
  }

  const subtotal = (order.products ?? []).reduce(
    (sum: number, p: { amount: number; price: number }) => sum + p.amount * p.price,
    0
  )
  const deliveryCost = order.deliveryCost ?? 0
  const total = subtotal + deliveryCost
  const deliveryLabel = order.deliveryOption ? DELIVERY_LABELS[order.deliveryOption] : null

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
      <CheckoutStepper step={2} />

      <Card className="mb-6">
        <CardContent className="p-6 space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order summary</h2>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Items subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Delivery {deliveryLabel ? `(${deliveryLabel})` : ''}</span>
            <span>${deliveryCost.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-base font-semibold text-gray-900">
            <span>Total charged</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      <PaymentStep orderId={orderId} />
    </div>
  )
}

export default CheckoutPaymentPage
