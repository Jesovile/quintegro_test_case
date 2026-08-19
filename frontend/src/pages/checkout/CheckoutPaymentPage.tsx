import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { PAY_ORDER, SUBMIT_ORDER } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCheckout } from './CheckoutContext'
import { useCountdown } from '@/hooks/useCountdown'
import CardPaymentForm from './payment/CardPaymentForm'
import PaypalPaymentForm from './payment/PaypalPaymentForm'
import { CardPaymentInput, PaypalPaymentInput, PaymentErrorCode } from '@/types/checkout'

const ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  DECLINED: 'Платёж отклонён банком-эмитентом.',
  INSUFFICIENT_FUNDS: 'Недостаточно средств.',
  EXPIRED_CARD: 'Истёк срок действия карты.',
  GATEWAY_UNAVAILABLE: 'Платёжный сервис временно недоступен. Попробуйте ещё раз.',
  RESERVATION_EXPIRED: 'Время резервирования товаров истекло.',
  INVALID_STATUS: 'Заказ не готов к оплате. Обновите страницу и попробуйте снова.',
}

const CheckoutPaymentPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { address, deliveryOption, reservation, paymentMethod, setPaymentResult, setSubmitFailed } = useCheckout()

  const [payOrder] = useMutation(PAY_ORDER)
  const [submitOrder] = useMutation(SUBMIT_ORDER)

  useEffect(() => {
    if (!address || !deliveryOption || !reservation || !paymentMethod) {
      history.replace(`/checkout/${orderId}/address`)
    }
  }, [address, deliveryOption, reservation, paymentMethod, orderId, history])

  const remaining = useCountdown(reservation?.reservedUntil)
  const [processing, setProcessing] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  if (!address || !deliveryOption || !reservation || !paymentMethod) {
    return null
  }

  const handlePay = async (payload: CardPaymentInput | PaypalPaymentInput) => {
    setProcessing(true)
    setErrorText(null)
    try {
      const payment =
        paymentMethod === 'card'
          ? { method: 'card', card: payload as CardPaymentInput }
          : { method: 'paypal', paypal: payload as PaypalPaymentInput }

      const { data: payData } = await payOrder({ variables: { orderId, payment } })
      const result = payData.payOrder
      if (!result.success) {
        setErrorText(result.errorCode ? ERROR_MESSAGES[result.errorCode as PaymentErrorCode] : 'Не удалось провести оплату.')
        if (result.errorCode === 'RESERVATION_EXPIRED') {
          history.push(`/checkout/${orderId}/address`)
        }
        return
      }

      let submitSuccess = true
      try {
        const { data: submitData } = await submitOrder({ variables: { orderId } })
        submitSuccess = !!submitData.submitOrder
      } catch (err) {
        console.error('Failed to submit order for fulfillment:', err)
        submitSuccess = false
      }

      setPaymentResult({ success: true, transactionId: undefined })
      setSubmitFailed(!submitSuccess)
      history.push(`/checkout/${orderId}/result`)
    } catch (err) {
      console.error('Failed to process payment:', err)
      setErrorText('Не удалось провести оплату. Попробуйте ещё раз.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Оплата</h1>
      {remaining !== null && <p className="text-sm text-amber-700 mb-6">Резерв истекает через {remaining}.</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {paymentMethod === 'card' ? 'Оплата картой' : 'Оплата через PayPal'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorText && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {errorText}
            </div>
          )}
          {paymentMethod === 'card' ? (
            <CardPaymentForm onSubmit={handlePay} processing={processing} />
          ) : (
            <PaypalPaymentForm onSubmit={handlePay} processing={processing} />
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="mt-4" onClick={() => history.push(`/checkout/${orderId}/review`)}>
        Назад к проверке заказа
      </Button>
    </div>
  )
}

export default CheckoutPaymentPage
