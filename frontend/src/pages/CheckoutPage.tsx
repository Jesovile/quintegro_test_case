import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { CHECKOUT_ORDER, START_CHECKOUT } from '../graphql/mutations'
import { GET_ORDER, GET_ORDERS } from '../graphql/queries'

interface PastOrder {
  status: string
  delivery?: {
    name: string; addressLine1: string; addressLine2: string
    zip: string; city: string; country: string
    phoneCode: string; phoneNumber: string; option: string
  }
  payment?: { cardLastFour: string; cardHolderName: string }
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Loader2 } from 'lucide-react'

const DELIVERY_OPTIONS = [
  { value: 'fast', label: 'Fast Delivery', description: '3–5 business days', price: 9.99 },
  { value: 'fastest', label: 'Fastest Delivery', description: '1 business day', price: 24.99 },
] as const

interface CheckoutForm {
  name: string
  addressLine1: string
  addressLine2: string
  zip: string
  city: string
  country: string
  phoneCode: string
  phoneNumber: string
  deliveryOption: 'fast' | 'fastest'
  cardHolderName: string
  cardNumber: string
  cardExpiry: string
  cardCvv: string
}

type FormErrors = Partial<Record<keyof CheckoutForm, string>>

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()

  const [form, setForm] = useState<CheckoutForm>({
    name: '',
    addressLine1: '',
    addressLine2: '',
    zip: '',
    city: '',
    country: '',
    phoneCode: '+1',
    phoneNumber: '',
    deliveryOption: 'fast',
    cardHolderName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: orderData, loading: orderLoading } = useQuery(GET_ORDER, {
    variables: { orderId },
  })

  const { data: allOrdersData } = useQuery(GET_ORDERS)

  // Prefill from the most recent past order that has delivery info
  useEffect(() => {
    const past: PastOrder[] = (allOrdersData?.orders ?? [])
      .filter((o: PastOrder) => (o.status === 'submited' || o.status === 'finished') && o.delivery)
    if (past.length === 0) return
    const { delivery, payment } = past[past.length - 1]
    if (!delivery) return
    setForm(prev => ({
      ...prev,
      name: delivery.name,
      addressLine1: delivery.addressLine1,
      addressLine2: delivery.addressLine2,
      zip: delivery.zip,
      city: delivery.city,
      country: delivery.country,
      phoneCode: delivery.phoneCode,
      phoneNumber: delivery.phoneNumber,
      cardHolderName: payment?.cardHolderName ?? prev.cardHolderName,
    }))
  }, [allOrdersData])

  const [startCheckout] = useMutation(START_CHECKOUT, {
    refetchQueries: [{ query: GET_ORDERS }],
  })

  const [checkoutOrder, { loading: submitting }] = useMutation(CHECKOUT_ORDER, {
    refetchQueries: [{ query: GET_ORDERS }],
    onCompleted: () => {
      history.push('/order')
    },
    onError: (error) => {
      setSubmitError(error.message)
    },
  })

  // Lock the order into checkout status as soon as the page loads
  useEffect(() => {
    startCheckout({ variables: { orderId } })
  }, [orderId])

  const handleChange = (field: keyof CheckoutForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return digits
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.addressLine1.trim()) newErrors.addressLine1 = 'Address is required'
    if (!form.zip.trim()) newErrors.zip = 'ZIP is required'
    if (!form.city.trim()) newErrors.city = 'City is required'
    if (!form.country.trim()) newErrors.country = 'Country is required'
    if (!form.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required'
    if (!form.cardHolderName.trim()) newErrors.cardHolderName = 'Cardholder name is required'
    if (form.cardNumber.replace(/\s/g, '').length < 16) newErrors.cardNumber = 'Enter a valid 16-digit card number'
    if (!/^\d{2}\/\d{2}$/.test(form.cardExpiry)) newErrors.cardExpiry = 'Enter expiry as MM/YY'
    if (form.cardCvv.length < 3) newErrors.cardCvv = 'Enter a valid CVV'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    checkoutOrder({
      variables: {
        orderId,
        input: {
          name: form.name,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          zip: form.zip,
          city: form.city,
          country: form.country,
          phoneCode: form.phoneCode,
          phoneNumber: form.phoneNumber,
          deliveryOption: form.deliveryOption,
          cardHolderName: form.cardHolderName,
          cardNumber: form.cardNumber,
          cardExpiry: form.cardExpiry,
          cardCvv: form.cardCvv,
        },
      },
    })
  }

  const selectedDelivery = DELIVERY_OPTIONS.find(o => o.value === form.deliveryOption)!
  const orderProducts: Array<{ product: { id: string; title: string; image: string }; amount: number; price: number }> =
    orderData?.order?.products ?? []
  const orderTotal = orderProducts.reduce((sum, item) => sum + item.amount * item.price, 0)

  if (orderLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Checkout</h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* Order items */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order items</h2>
            <div className="divide-y divide-gray-100">
              {orderProducts.map(item => (
                <div key={item.product.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Avatar className="w-12 h-12 rounded-lg border border-gray-200 shrink-0">
                    <AvatarImage src={item.product.image} alt={item.product.title} />
                    <AvatarFallback className="text-sm font-semibold bg-gray-100 text-gray-600">
                      {item.product.title.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium text-gray-900">{item.product.title}</span>
                  <span className="text-sm text-gray-500">×{item.amount}</span>
                  <span className="text-sm font-semibold text-blue-600">${(item.price * item.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery details</h2>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Full name" error={errors.name}>
                <Input
                  placeholder="John Doe"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                />
              </Field>
              <Field label="Address line 1" error={errors.addressLine1}>
                <Input
                  placeholder="123 Main St"
                  value={form.addressLine1}
                  onChange={e => handleChange('addressLine1', e.target.value)}
                />
              </Field>
              <Field label="Address line 2" error={errors.addressLine2}>
                <Input
                  placeholder="Apt, suite, floor (optional)"
                  value={form.addressLine2}
                  onChange={e => handleChange('addressLine2', e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="ZIP / Postal code" error={errors.zip}>
                  <Input
                    placeholder="10001"
                    value={form.zip}
                    onChange={e => handleChange('zip', e.target.value)}
                  />
                </Field>
                <Field label="City" error={errors.city}>
                  <Input
                    placeholder="New York"
                    value={form.city}
                    onChange={e => handleChange('city', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Country" error={errors.country}>
                <Input
                  placeholder="United States"
                  value={form.country}
                  onChange={e => handleChange('country', e.target.value)}
                />
              </Field>
              <Field label="Phone number" error={errors.phoneNumber}>
                <div className="flex gap-2">
                  <Input
                    placeholder="+1"
                    value={form.phoneCode}
                    onChange={e => handleChange('phoneCode', e.target.value)}
                    className="w-20 shrink-0"
                  />
                  <Input
                    placeholder="555 000 0000"
                    value={form.phoneNumber}
                    onChange={e => handleChange('phoneNumber', e.target.value)}
                  />
                </div>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Delivery options */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery option</h2>
            <div className="grid grid-cols-2 gap-4">
              {DELIVERY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChange('deliveryOption', option.value)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    form.deliveryOption === option.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  <p className="text-blue-600 font-bold mt-2">${option.price.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Cardholder name" error={errors.cardHolderName}>
                <Input
                  placeholder="John Doe"
                  value={form.cardHolderName}
                  onChange={e => handleChange('cardHolderName', e.target.value)}
                />
              </Field>
              <Field label="Card number" error={errors.cardNumber}>
                <Input
                  placeholder="0000 0000 0000 0000"
                  value={form.cardNumber}
                  onChange={e => handleChange('cardNumber', formatCardNumber(e.target.value))}
                  maxLength={19}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry (MM/YY)" error={errors.cardExpiry}>
                  <Input
                    placeholder="MM/YY"
                    value={form.cardExpiry}
                    onChange={e => handleChange('cardExpiry', formatExpiry(e.target.value))}
                    maxLength={5}
                  />
                </Field>
                <Field label="CVV" error={errors.cardCvv}>
                  <Input
                    placeholder="123"
                    value={form.cardCvv}
                    onChange={e => handleChange('cardCvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Order summary</h2>
            <div className="flex justify-between text-gray-600 mb-2">
              <span>Subtotal</span>
              <span>${orderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600 mb-2">
              <span>Delivery ({selectedDelivery.label})</span>
              <span>${selectedDelivery.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-3 mt-3">
              <span>Total</span>
              <span>${(orderTotal + selectedDelivery.price).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {submitError && (
          <p className="text-red-600 text-sm mb-4">{submitError}</p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Place Order'}
        </Button>
      </form>
    </div>
  )
}

interface FieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

const Field: React.FC<FieldProps> = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
)

export default CheckoutPage
