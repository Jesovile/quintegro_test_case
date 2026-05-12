import React from 'react'
import { useParams, useHistory, Redirect } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Loader2, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GET_ORDER } from '@/graphql/queries'
import CheckoutStepper from '@/components/checkout/CheckoutStepper'

interface RouteParams {
  orderId: string
}

const CheckoutProcessingPage: React.FC = () => {
  const { orderId } = useParams<RouteParams>()
  const history = useHistory()

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
  if (order.status === 'created') {
    return <Redirect to={`/checkout/${orderId}/delivery`} />
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
      <CheckoutStepper step={3} />

      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Thank you — your order is being processed
          </h2>
          <p className="text-gray-600 mb-6">
            We&apos;ve sent your payment to the bank. Your order is now in{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-sm font-medium">
              <Clock className="h-3.5 w-3.5" /> processing
            </span>{' '}
            while we verify the transaction.
          </p>

          <div className="bg-gray-50 rounded-md border border-gray-200 p-4 text-left text-sm text-gray-700 space-y-1 mb-6">
            <div>
              <span className="font-medium">Order ID:</span> {order.orderId}
            </div>
            {order.deliveryOption && (
              <div>
                <span className="font-medium">Delivery:</span>{' '}
                {order.deliveryOption === 'fast'
                  ? 'Fast'
                  : order.deliveryOption === 'super_fast'
                  ? 'Super Fast'
                  : 'Extra Fast'}{' '}
                {typeof order.deliveryCost === 'number' && (
                  <span className="text-gray-500">(${order.deliveryCost.toFixed(2)})</span>
                )}
              </div>
            )}
            {order.payment && (
              <>
                <div>
                  <span className="font-medium">Card:</span> •••• {order.payment.last4}
                </div>
                <div>
                  <span className="font-medium">Bank transaction:</span>{' '}
                  {order.payment.bankTxnId}
                </div>
              </>
            )}
          </div>

          <Button onClick={() => history.push('/order')}>Back to orders</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default CheckoutProcessingPage
