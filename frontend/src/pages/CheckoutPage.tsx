import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useHistory, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput'
import type { AddressSuggestion } from '@/address/addressAutocomplete'
import { GET_ORDER } from '@/graphql/queries'
import { SUBMIT_ORDER } from '@/graphql/mutations'
import { paymentGateway } from '@/payment/mockPaymentGateway'

type ProductItem = { product: { id: string; title: string }; amount: number; price: number }
type Order = { orderId: string; status: string; products: ProductItem[] }
type FormValues = { recipientName: string; phone: string; city: string; addressLine1: string; postalCode: string; cardNumber: string; holderName: string; expiry: string; cvv: string }
type FormErrors = Partial<Record<keyof FormValues, string>>

const initialValues: FormValues = {
  cardNumber: '', holderName: '', expiry: '', cvv: '',
  recipientName: '', phone: '', city: '', addressLine1: '', postalCode: '',
}

const onlyDigits = (value: string) => value.replace(/\D/g, '')

const formatCardNumber = (value: string) => onlyDigits(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
const formatExpiry = (value: string) => {
  const digits = onlyDigits(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {}
  const cardNumber = onlyDigits(values.cardNumber)
  const [monthValue, yearValue] = values.expiry.split('/')
  const month = Number(monthValue)
  const year = 2000 + Number(yearValue)
  const now = new Date()

  if (cardNumber.length < 13 || cardNumber.length > 19) errors.cardNumber = 'Введите номер карты'
  if (!values.holderName.trim()) errors.holderName = 'Введите имя держателя карты'
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(values.expiry) || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    errors.expiry = 'Введите действительный срок в формате MM/YY'
  }
  if (!/^\d{3,4}$/.test(values.cvv)) errors.cvv = 'Введите CVV (3 или 4 цифры)'
  if (!values.recipientName.trim()) errors.recipientName = 'Введите имя получателя'
  if (!values.phone.trim()) errors.phone = 'Введите телефон'
  if (!values.city.trim()) errors.city = 'Введите город'
  if (!values.addressLine1.trim()) errors.addressLine1 = 'Введите адрес'
  return errors
}

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isPaying, setIsPaying] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { data, loading, error } = useQuery<{ order: Order }>(GET_ORDER, { variables: { orderId } })
  const [submitOrder] = useMutation(SUBMIT_ORDER)
  const order = data?.order
  const total = useMemo(() => order?.products.reduce((sum, item) => sum + item.amount * item.price, 0) ?? 0, [order])

  const update = (field: keyof FormValues, value: string) => {
    setValues(previous => ({ ...previous, [field]: value }))
    if (errors[field]) setErrors(previous => ({ ...previous, [field]: undefined }))
  }

  const selectAddress = (suggestion: AddressSuggestion) => {
    setValues(previous => ({
      ...previous,
      addressLine1: suggestion.addressLine1 ?? suggestion.label,
      city: suggestion.city ?? previous.city,
      postalCode: suggestion.postalCode ?? previous.postalCode,
    }))
    setErrors(previous => ({ ...previous, addressLine1: undefined, city: undefined }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!order || isPaying) return
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsPaying(true)
    setSubmitError('')
    try {
      const [month, shortYear] = values.expiry.split('/')
      await paymentGateway.pay({
        orderId: order.orderId,
        amount: total,
        currency: 'USD',
        card: {
          number: onlyDigits(values.cardNumber),
          holderName: values.holderName.trim(),
          expiryMonth: Number(month),
          expiryYear: 2000 + Number(shortYear),
          cvv: values.cvv,
        },
      })

      await submitOrder({
        variables: {
          orderId: order.orderId,
          deliveryInfo: {
            recipientName: values.recipientName,
            phone: values.phone,
            city: values.city,
            addressLine1: values.addressLine1,
            postalCode: values.postalCode || null,
          },
        },
      })
      history.replace(`/orders/${order.orderId}/confirmation`)
    } catch {
      setSubmitError('Не удалось обработать платёж. Попробуйте ещё раз.')
      setIsPaying(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
  if (error || !order) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">Не удалось загрузить заказ.</div>
  if (order.status !== 'created') return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">Этот заказ уже нельзя оформить повторно.</div>

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="text-3xl font-bold text-gray-900">Оформление заказа</h1><p className="mt-2 text-gray-600">Заказ №{order.orderId}</p></div>
      <Card><CardHeader><CardTitle>Данные карты</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Номер карты" error={errors.cardNumber} className="md:col-span-2"><Input value={values.cardNumber} onChange={e => update('cardNumber', formatCardNumber(e.target.value))} autoComplete="cc-number" inputMode="numeric" placeholder="1234 5678 9012 3456" /></Field>
        <Field label="Имя держателя" error={errors.holderName}><Input value={values.holderName} onChange={e => update('holderName', e.target.value)} autoComplete="cc-name" placeholder="IVAN IVANOV" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Срок действия" error={errors.expiry}><Input value={values.expiry} onChange={e => update('expiry', formatExpiry(e.target.value))} autoComplete="cc-exp" inputMode="numeric" placeholder="MM/YY" /></Field><Field label="CVV" error={errors.cvv}><Input value={values.cvv} onChange={e => update('cvv', onlyDigits(e.target.value).slice(0, 4))} type="password" autoComplete="cc-csc" inputMode="numeric" placeholder="•••" /></Field></div>
        <p className="md:col-span-2 flex items-center gap-2 text-sm text-gray-500"><LockKeyhole className="h-4 w-4" />Тестовая оплата: данные карты не сохраняются.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Адрес доставки</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="Получатель" error={errors.recipientName}><Input value={values.recipientName} onChange={e => update('recipientName', e.target.value)} autoComplete="name" /></Field>
        <Field label="Телефон" error={errors.phone}><Input value={values.phone} onChange={e => update('phone', e.target.value)} autoComplete="tel" inputMode="tel" /></Field>
        <Field label="Город" error={errors.city}><Input value={values.city} onChange={e => update('city', e.target.value)} autoComplete="address-level2" /></Field>
        <Field label="Почтовый индекс (необязательно)"><Input value={values.postalCode} onChange={e => update('postalCode', e.target.value)} autoComplete="postal-code" /></Field>
        <Field label="Улица, дом, квартира" error={errors.addressLine1} className="md:col-span-2"><AddressAutocompleteInput id="delivery-address" value={values.addressLine1} onChange={value => update('addressLine1', value)} onSelect={selectAddress} /></Field>
      </CardContent></Card>
      <Card><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-gray-500">К оплате</p><p className="text-2xl font-bold">${total.toFixed(2)}</p></div><Button type="submit" disabled={isPaying} className="min-w-56">{isPaying ? 'Обрабатываем платёж…' : 'Оплатить и оформить заказ'}</Button></CardContent></Card>
      {submitError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{submitError}</p>}
    </form>
  )
}

const Field: React.FC<{ label: string; error?: string; className?: string; children: React.ReactNode }> = ({ label, error, className, children }) => (
  <label className={`grid self-start content-start gap-1 text-sm font-medium text-gray-700 ${className ?? ''}`}>
    <span>{label}</span>
    {children}
    {error ? (
      <span role="alert" className="min-h-[1.25rem] text-sm font-normal leading-5 text-red-600">{error}</span>
    ) : (
      <span aria-hidden="true" className="min-h-[1.25rem] leading-5">&nbsp;</span>
    )}
  </label>
)

export default CheckoutPage
