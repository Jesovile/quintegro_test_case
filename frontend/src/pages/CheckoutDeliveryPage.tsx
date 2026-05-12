import React from 'react'
import { useParams, useHistory, Redirect } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { GET_ORDER } from '@/graphql/queries'
import CheckoutStepper from '@/components/checkout/CheckoutStepper'
import DeliveryStep from '@/components/checkout/DeliveryStep'
import type { AddressInput } from '@/lib/checkoutSchemas'

interface RouteParams {
  orderId: string
}

const CheckoutDeliveryPage: React.FC = () => {
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
  if (order.status !== 'created') {
    return <Redirect to={`/checkout/${orderId}/processing`} />
  }

  const initialDelivery = order.deliveryAddress
    ? (stripTypename(order.deliveryAddress) as AddressInput)
    : undefined
  const initialInvoice = order.invoiceAddress
    ? (stripTypename(order.invoiceAddress) as AddressInput)
    : undefined

  return (
    <div className="max-w-3xl mx-auto py-8">
      <button
        onClick={() => history.push('/order')}
        className="text-sm text-blue-600 hover:underline mb-4"
      >
        ← Back to cart
      </button>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>
      <CheckoutStepper step={1} />
      <DeliveryStep
        orderId={orderId}
        products={(order.products ?? []).map((p: { amount: number; price: number }) => ({
          amount: p.amount,
          price: p.price,
        }))}
        initialDelivery={initialDelivery}
        initialInvoice={initialInvoice}
        initialDeliveryOption={order.deliveryOption ?? undefined}
      />
    </div>
  )
}

const stripTypename = <T extends Record<string, unknown>>(obj: T): Omit<T, '__typename'> => {
  const { __typename, ...rest } = obj as T & { __typename?: string }
  return rest
}

export default CheckoutDeliveryPage
