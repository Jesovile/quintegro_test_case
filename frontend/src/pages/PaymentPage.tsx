import React, { useState } from 'react'
import { useParams, useHistory, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDER, GET_PAYMENT_METHODS } from '../graphql/queries'
import { PAY_ORDER } from '../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import CardPaymentForm, { CardPaymentValues } from '@/components/CardPaymentForm'

const PaymentPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const [payError, setPayError] = useState('')

  const { data, loading, error, refetch } = useQuery(GET_ORDER, {
    variables: { orderId },
    fetchPolicy: 'network-only',
  })

  const { data: paymentMethodsData } = useQuery(GET_PAYMENT_METHODS)

  const [payOrder, { loading: paying }] = useMutation(PAY_ORDER, {
    onCompleted: (result) => {
      if (result.payOrder.success) {
        history.push('/order')
      } else {
        setPayError('Payment was declined. Please try a different card or payment method.')
        refetch()
      }
    },
    onError: (err) => {
      setPayError(err.message || 'Payment failed. Please try again.')
    },
  })

  const order = data?.order

  const handleCardPay = (values: CardPaymentValues) => {
    setPayError('')
    payOrder({
      variables: {
        orderId,
        input: values,
      },
    })
  }

  const handleRedirectPay = () => {
    setPayError('')
    payOrder({
      variables: {
        orderId,
        input: null,
      },
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        <p className="text-sm font-medium">
          {error ? error.message : 'Order not found.'}
        </p>
        <Link to="/order" className="text-sm underline mt-2 inline-block">
          Back to orders
        </Link>
      </div>
    )
  }

  if (order.status !== 'submitted') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment is not available</h2>
        <p className="text-gray-600 mb-4">
          Order #{order.orderId} is currently "{order.status}" and cannot be paid for right now.
        </p>
        <Link to="/order" className="text-blue-600 underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const paymentMethods: { id: string; label: string }[] = paymentMethodsData?.paymentMethods || []
  const chosenMethod = paymentMethods.find((m) => m.id === order.paymentMethodId)
  const chosenLabel = chosenMethod?.label || order.paymentMethodId

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Payment — Order #{order.orderId}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{chosenLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {order.paymentMethodId === 'card' ? (
            <CardPaymentForm onPay={handleCardPay} submitting={paying} />
          ) : (
            <div className="flex justify-end">
              <Button
                onClick={handleRedirectPay}
                disabled={paying}
                className="min-w-[220px] h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {paying ? 'Processing...' : `Proceed to payment in ${chosenLabel}`}
              </Button>
            </div>
          )}

          {payError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mt-4">
              <p className="text-sm font-medium">{payError}</p>
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => history.push(`/order/${orderId}/checkout`)}
              className="text-sm text-blue-600 underline"
            >
              Back to checkout details
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentPage
