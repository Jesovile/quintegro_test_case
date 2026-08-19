import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { SUBMIT_ORDER } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useCheckout } from './CheckoutContext'

const CheckoutResultPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { paymentResult, submitFailed, setSubmitFailed, reset } = useCheckout()
  const [submitOrder] = useMutation(SUBMIT_ORDER)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!paymentResult) {
      history.replace(`/checkout/${orderId}/address`)
    }
  }, [paymentResult, orderId, history])

  if (!paymentResult) {
    return null
  }

  const handleRetrySubmit = async () => {
    setRetrying(true)
    try {
      // submitOrder на бэке идемпотентен — безопасно повторить, оплата заново не списывается.
      const { data } = await submitOrder({ variables: { orderId } })
      setSubmitFailed(!data.submitOrder)
    } catch (err) {
      console.error('Failed to retry order submission:', err)
      setSubmitFailed(true)
    } finally {
      setRetrying(false)
    }
  }

  const handleBackToOrders = () => {
    reset()
    history.push('/order')
  }

  if (!paymentResult.success) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <XCircle className="mx-auto h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Оплата не прошла</h1>
        <p className="mt-2 text-gray-600">{paymentResult.errorMessage || 'Попробуйте повторить оплату.'}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={() => history.push(`/checkout/${orderId}/payment`)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Повторить оплату
          </Button>
          <Button variant="outline" onClick={handleBackToOrders}>
            К заказам
          </Button>
        </div>
      </div>
    )
  }

  if (submitFailed) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <AlertTriangle className="mx-auto h-16 w-16 text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Оплата прошла успешно</h1>
        <p className="mt-2 text-gray-600">
          Не удалось подтвердить отправку заказа #{orderId} в сборку. Деньги списаны, зарезервированные товары
          сохранены за вами — повторите отправку.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={handleRetrySubmit} disabled={retrying} className="bg-blue-600 hover:bg-blue-700 text-white">
            {retrying ? 'Повторяем...' : 'Повторить отправку в сборку'}
          </Button>
          <Button variant="outline" onClick={handleBackToOrders}>
            К заказам
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Заказ оплачен</h1>
      <p className="mt-2 text-gray-600">Заказ #{orderId} оплачен и отправлен в сборку.</p>
      <Button onClick={handleBackToOrders} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
        К заказам
      </Button>
    </div>
  )
}

export default CheckoutResultPage
