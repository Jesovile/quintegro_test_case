import React, { useEffect } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_ORDER, GET_ORDER_SUM } from '@/graphql/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import OrderListItem from '@/components/OrderListItem'
import { useCheckout } from './CheckoutContext'
import { useCountdown } from '@/hooks/useCountdown'
import { PaymentMethod } from '@/types/checkout'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; description: string }[] = [
  { value: 'card', label: 'Банковская карта', description: 'Visa, Mastercard и другие' },
  { value: 'paypal', label: 'PayPal', description: 'Оплата через аккаунт PayPal' },
]

const CheckoutReviewPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { address, deliveryOption, reservation, paymentMethod, setPaymentMethod } = useCheckout()

  useEffect(() => {
    if (!address || !deliveryOption || !reservation) {
      history.replace(`/checkout/${orderId}/address`)
    }
  }, [address, deliveryOption, reservation, orderId, history])

  const { data, loading, error } = useQuery(GET_ORDER, { variables: { orderId } })

  const { data: sumData, loading: sumLoading } = useQuery(GET_ORDER_SUM, {
    variables: {
      orderId,
      products:
        data?.order?.products.map((p: { product: { id: string }; amount: number; price: number }) => ({
          id: p.product.id,
          amount: p.amount,
          price: p.price,
        })) ?? [],
    },
    skip: !data?.order,
  })

  const remaining = useCountdown(reservation?.reservedUntil)

  if (!address || !deliveryOption || !reservation) {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !data?.order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        Заказ не найден или недоступен.
      </div>
    )
  }

  const order = data.order

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Проверьте заказ</h1>
      {remaining !== null && (
        <p className="text-sm text-amber-700 mb-6">
          Товары зарезервированы. Успейте оплатить в течение {remaining}.
        </p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Состав заказа</CardTitle>
        </CardHeader>
        <CardContent>
          {order.products.map((item: { product: { id: string }; amount: number; price: number }, index: number) => (
            <OrderListItem
              key={item.product.id}
              product={item.product as { id: string; title: string; description: string; image: string }}
              amount={item.amount}
              price={item.price}
              orderId={order.orderId}
              status={order.status}
              isLast={index === order.products.length - 1}
              readOnly
            />
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Адрес и доставка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{address.fullName}</p>
          <p>
            {address.country}, {address.city}, {address.street}, {address.postalCode}
          </p>
          <p>{address.phone}</p>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="font-medium text-gray-900">{deliveryOption.title}</p>
            <p className="text-gray-600">
              {deliveryOption.description} · {deliveryOption.etaDays} дн. ·{' '}
              {deliveryOption.price === 0 ? 'бесплатно' : `$${deliveryOption.price.toFixed(2)}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Способ оплаты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PAYMENT_METHODS.map((method) => (
            <Card
              key={method.value}
              onClick={() => setPaymentMethod(method.value)}
              className={`cursor-pointer p-4 transition-colors ${
                paymentMethod === method.value ? 'border-blue-600 ring-2 ring-blue-200' : 'hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{method.label}</p>
              <p className="text-sm text-gray-600">{method.description}</p>
            </Card>
          ))}
        </CardContent>
      </Card>

      <div className="bg-blue-600 text-white p-6 mb-6 rounded-lg shadow-md flex items-center justify-between">
        <div>
          <p className="text-sm text-blue-100">
            Товары {sumLoading ? '...' : `$${(sumData?.orderSum ?? 0).toFixed(2)}`} + доставка{' '}
            {deliveryOption.price === 0 ? 'бесплатно' : `$${deliveryOption.price.toFixed(2)}`}
          </p>
          <h3 className="text-xl font-bold">
            Итого: {sumLoading ? '...' : `$${((sumData?.orderSum ?? 0) + deliveryOption.price).toFixed(2)}`}
          </h3>
        </div>
        {sumLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      </div>

      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={() => history.push(`/checkout/${orderId}/address`)}>
          Назад
        </Button>
        <Button
          onClick={() => history.push(`/checkout/${orderId}/payment`)}
          disabled={!paymentMethod}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          К оплате
        </Button>
      </div>
    </div>
  )
}

export default CheckoutReviewPage
