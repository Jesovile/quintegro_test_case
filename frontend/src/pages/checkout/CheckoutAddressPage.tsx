import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { GET_ORDER, GET_DELIVERY_OPTIONS } from '@/graphql/queries'
import { RESERVE_ORDER } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useCheckout } from './CheckoutContext'
import { Address, DeliveryOption, ReserveItemIssue } from '@/types/checkout'

const CITY_HINT =
  'Например: Moscow, Saint Petersburg, Berlin, London, New York — для этих городов доступен и самовывоз.'

const DELIVERY_RECALC_DEBOUNCE_MS = 600

const EMPTY_ADDRESS: Address = {
  fullName: '',
  country: 'Russia',
  city: '',
  street: '',
  postalCode: '',
  phone: '',
}

const CheckoutAddressPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const apolloClient = useApolloClient()
  const { address, setAddress, deliveryOption, setDeliveryOption, setReservation } = useCheckout()

  const { data, loading: orderLoading, error: orderError } = useQuery(GET_ORDER, {
    variables: { orderId },
  })

  const [reserveOrder] = useMutation(RESERVE_ORDER)

  const [form, setForm] = useState<Address>(address ?? EMPTY_ADDRESS)
  const [options, setOptions] = useState<DeliveryOption[] | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(deliveryOption?.id ?? null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [issues, setIssues] = useState<ReserveItemIssue[] | null>(null)
  const [reserveErrorText, setReserveErrorText] = useState<string | null>(null)

  const handleFieldChange = (field: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  // Варианты доставки пересчитываются автоматически при изменении города/страны,
  // без отдельной кнопки — с debounce, чтобы не дёргать бэкенд на каждое нажатие клавиши.
  useEffect(() => {
    if (!form.city.trim()) {
      setOptions(null)
      setSelectedOptionId(null)
      return
    }

    setIssues(null)
    setReserveErrorText(null)
    setLoadingOptions(true)

    const timeout = setTimeout(async () => {
      try {
        const { data: optionsData } = await apolloClient.query({
          query: GET_DELIVERY_OPTIONS,
          variables: { orderId, address: form },
          fetchPolicy: 'network-only',
        })
        const result: DeliveryOption[] = optionsData?.deliveryOptions ?? []
        setOptions(result)
        setSelectedOptionId((prev) => (prev && result.some((o) => o.id === prev) ? prev : null))
      } catch (err) {
        console.error('Failed to fetch delivery options:', err)
        setOptions([])
      } finally {
        setLoadingOptions(false)
      }
    }, DELIVERY_RECALC_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city, form.country, orderId])

  const handleContinue = async () => {
    if (!data?.order || !selectedOptionId || !options) return
    const selected = options.find((o) => o.id === selectedOptionId)
    if (!selected) return

    setReserving(true)
    setIssues(null)
    setReserveErrorText(null)
    try {
      const { data: reserveData } = await reserveOrder({
        variables: { orderId, address: form, deliveryOptionId: selectedOptionId },
      })
      const result = reserveData.reserveOrder
      if (!result.success) {
        if (result.errorCode === 'INSUFFICIENT_STOCK' && result.issues) {
          setIssues(result.issues)
        } else {
          setReserveErrorText('Не удалось зарезервировать заказ. Попробуйте ещё раз.')
        }
        return
      }
      setAddress(form)
      setDeliveryOption(selected)
      setReservation({ success: true, reservedUntil: result.reservedUntil })
      history.push(`/checkout/${orderId}/review`)
    } catch (err) {
      console.error('Failed to reserve order:', err)
      setReserveErrorText('Не удалось зарезервировать заказ. Попробуйте ещё раз.')
    } finally {
      setReserving(false)
    }
  }

  if (orderLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (orderError || !data?.order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        Заказ не найден или недоступен.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Оформление заказа</h1>

      {issues && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-2">Недостаточно товара для резервирования:</p>
              <ul className="text-sm space-y-1">
                {issues.map((issue) => (
                  <li key={issue.productId}>
                    {issue.productTitle}: запрошено {issue.requested}, доступно {issue.available}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => history.push('/order')}>
                Вернуться к заказам
              </Button>
            </div>
          </div>
        </div>
      )}

      {reserveErrorText && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {reserveErrorText}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Адрес доставки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Получатель</label>
              <Input value={form.fullName} onChange={handleFieldChange('fullName')} required placeholder="Иван Иванов" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Страна</label>
                <Input value={form.country} onChange={handleFieldChange('country')} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Город</label>
                <Input value={form.city} onChange={handleFieldChange('city')} required placeholder="Moscow" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Улица, дом</label>
              <Input value={form.street} onChange={handleFieldChange('street')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Индекс</label>
                <Input value={form.postalCode} onChange={handleFieldChange('postalCode')} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Телефон</label>
                <Input value={form.phone} onChange={handleFieldChange('phone')} required placeholder="+7 900 000-00-00" />
              </div>
            </div>
            <p className="text-xs text-gray-500">{CITY_HINT}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Способ доставки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!form.city.trim() && (
            <p className="text-sm text-gray-600">Укажите город, чтобы увидеть варианты доставки.</p>
          )}
          {loadingOptions && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Пересчитываем варианты доставки...
            </div>
          )}
          {!loadingOptions && options && options.length === 0 && (
            <p className="text-sm text-gray-600">Доставка недоступна для указанного адреса.</p>
          )}
          {!loadingOptions &&
            options?.map((option) => (
              <Card
                key={option.id}
                onClick={() => setSelectedOptionId(option.id)}
                className={`cursor-pointer p-4 transition-colors ${
                  selectedOptionId === option.id ? 'border-blue-600 ring-2 ring-blue-200' : 'hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{option.title}</p>
                    <p className="text-sm text-gray-600">{option.description}</p>
                    <p className="text-sm text-gray-500">Срок: {option.etaDays} дн.</p>
                  </div>
                  <p className="font-bold text-blue-600">
                    {option.price === 0 ? 'Бесплатно' : `$${option.price.toFixed(2)}`}
                  </p>
                </div>
              </Card>
            ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleContinue}
        disabled={!selectedOptionId || reserving}
        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
      >
        {reserving ? 'Резервируем товары...' : 'Продолжить'}
      </Button>
    </div>
  )
}

export default CheckoutAddressPage
