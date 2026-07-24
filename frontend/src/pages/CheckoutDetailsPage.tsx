import React, { useEffect, useState } from 'react'
import { useParams, useHistory, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDER, GET_PAYMENT_METHODS } from '../graphql/queries'
import { SUBMIT_ORDER } from '../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface Address {
  country: string
  city: string
  streetAndHouseNumber: string
  postalCode: string
  phone: string
}

const EMPTY_ADDRESS: Address = {
  country: '',
  city: '',
  streetAndHouseNumber: '',
  postalCode: '',
  phone: '',
}

// Decodes the `name` claim from the stored JWT without pulling in a
// jwt-decode dependency — the token is a standard base64url-encoded JWT.
const getAccountNameFromToken = (): string => {
  const token = localStorage.getItem('auth_token')
  if (!token) return ''
  try {
    const payloadSegment = token.split('.')[1]
    if (!payloadSegment) return ''
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    const payload = JSON.parse(json)
    return typeof payload.name === 'string' ? payload.name : ''
  } catch {
    return ''
  }
}

const ALLOWED_STATUSES = ['created', 'submitted']

const CheckoutDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()

  const { data, loading, error } = useQuery(GET_ORDER, {
    variables: { orderId },
    fetchPolicy: 'network-only',
  })

  const { data: paymentMethodsData } = useQuery(GET_PAYMENT_METHODS)

  const [recipientName, setRecipientName] = useState('')
  const [shipping, setShipping] = useState<Address>(EMPTY_ADDRESS)
  const [billing, setBilling] = useState<Address>(EMPTY_ADDRESS)
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [comment, setComment] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  const order = data?.order

  useEffect(() => {
    if (!order || prefilled) return
    setRecipientName(order.recipientName || getAccountNameFromToken())
    if (order.shippingAddress) {
      setShipping({
        country: order.shippingAddress.country || '',
        city: order.shippingAddress.city || '',
        streetAndHouseNumber: order.shippingAddress.streetAndHouseNumber || '',
        postalCode: order.shippingAddress.postalCode || '',
        phone: order.shippingAddress.phone || '',
      })
    }
    if (order.billingAddress) {
      setBilling({
        country: order.billingAddress.country || '',
        city: order.billingAddress.city || '',
        streetAndHouseNumber: order.billingAddress.streetAndHouseNumber || '',
        postalCode: order.billingAddress.postalCode || '',
        phone: order.billingAddress.phone || '',
      })
      const shippingAddr = order.shippingAddress
      const billingAddr = order.billingAddress
      const isSame = shippingAddr && billingAddr &&
        shippingAddr.country === billingAddr.country &&
        shippingAddr.city === billingAddr.city &&
        shippingAddr.streetAndHouseNumber === billingAddr.streetAndHouseNumber &&
        shippingAddr.postalCode === billingAddr.postalCode &&
        shippingAddr.phone === billingAddr.phone
      setSameAsShipping(!!isSame)
    }
    if (order.comment) setComment(order.comment)
    if (order.paymentMethodId) setPaymentMethodId(order.paymentMethodId)
    setPrefilled(true)
  }, [order, prefilled])

  const [submitOrder, { loading: submitting }] = useMutation(SUBMIT_ORDER, {
    onCompleted: () => {
      history.push(`/order/${orderId}/payment`)
    },
    onError: (err) => {
      setSubmitError(err.message || 'Failed to submit order. Please try again.')
    },
  })

  const updateShippingField = (field: keyof Address, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }))
  }

  const updateBillingField = (field: keyof Address, value: string) => {
    setBilling((prev) => ({ ...prev, [field]: value }))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!recipientName.trim()) errors.recipientName = 'Recipient name is required'

    const shippingFields: (keyof Address)[] = ['country', 'city', 'streetAndHouseNumber', 'postalCode', 'phone']
    shippingFields.forEach((field) => {
      if (!shipping[field].trim()) errors[`shipping.${field}`] = 'This field is required'
    })

    if (!sameAsShipping) {
      shippingFields.forEach((field) => {
        if (!billing[field].trim()) errors[`billing.${field}`] = 'This field is required'
      })
    }

    if (!paymentMethodId) errors.paymentMethodId = 'Please choose a payment method'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) return

    try {
      await submitOrder({
        variables: {
          orderId,
          input: {
            recipientName: recipientName.trim(),
            shipping,
            billing: sameAsShipping ? null : billing,
            comment: comment.trim() ? comment.trim() : null,
            paymentMethodId,
          },
        },
      })
    } catch {
      // handled by onError
    }
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

  if (!ALLOWED_STATUSES.includes(order.status)) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Checkout is not available</h2>
        <p className="text-gray-600 mb-4">
          Order #{order.orderId} is currently "{order.status}" and can no longer go through checkout.
        </p>
        <Link to="/order" className="text-blue-600 underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const renderAddressFields = (
    values: Address,
    onChange: (field: keyof Address, value: string) => void,
    prefix: string
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <Label htmlFor={`${prefix}-country`}>Country</Label>
        <Input
          id={`${prefix}-country`}
          value={values.country}
          onChange={(e) => onChange('country', e.target.value)}
        />
        {fieldErrors[`${prefix}.country`] && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors[`${prefix}.country`]}</p>
        )}
      </div>
      <div>
        <Label htmlFor={`${prefix}-city`}>City</Label>
        <Input
          id={`${prefix}-city`}
          value={values.city}
          onChange={(e) => onChange('city', e.target.value)}
        />
        {fieldErrors[`${prefix}.city`] && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors[`${prefix}.city`]}</p>
        )}
      </div>
      <div>
        <Label htmlFor={`${prefix}-street`}>Street & house number</Label>
        <Input
          id={`${prefix}-street`}
          value={values.streetAndHouseNumber}
          onChange={(e) => onChange('streetAndHouseNumber', e.target.value)}
        />
        {fieldErrors[`${prefix}.streetAndHouseNumber`] && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors[`${prefix}.streetAndHouseNumber`]}</p>
        )}
      </div>
      <div>
        <Label htmlFor={`${prefix}-postalCode`}>Postal code</Label>
        <Input
          id={`${prefix}-postalCode`}
          value={values.postalCode}
          onChange={(e) => onChange('postalCode', e.target.value)}
        />
        {fieldErrors[`${prefix}.postalCode`] && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors[`${prefix}.postalCode`]}</p>
        )}
      </div>
      <div>
        <Label htmlFor={`${prefix}-phone`}>Phone</Label>
        <Input
          id={`${prefix}-phone`}
          value={values.phone}
          onChange={(e) => onChange('phone', e.target.value)}
        />
        {fieldErrors[`${prefix}.phone`] && (
          <p className="text-sm text-red-600 mt-1">{fieldErrors[`${prefix}.phone`]}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Checkout — Order #{order.orderId}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="recipientName">Recipient name</Label>
            <Input
              id="recipientName"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
            {fieldErrors.recipientName && (
              <p className="text-sm text-red-600 mt-1">{fieldErrors.recipientName}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping address</CardTitle>
          </CardHeader>
          <CardContent>
            {renderAddressFields(shipping, updateShippingField, 'shipping')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                id="sameAsShipping"
                checked={sameAsShipping}
                onChange={(e) => setSameAsShipping(e.target.checked)}
              />
              <Label htmlFor="sameAsShipping" className="mb-0">
                Billing address is the same as shipping address
              </Label>
            </div>
            {!sameAsShipping && renderAddressFields(billing, updateBillingField, 'billing')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comment</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional order comment"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
            >
              <option value="">Select a payment method</option>
              {(paymentMethodsData?.paymentMethods || []).map((method: { id: string; label: string }) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </Select>
            {fieldErrors.paymentMethodId && (
              <p className="text-sm text-red-600 mt-1">{fieldErrors.paymentMethodId}</p>
            )}
          </CardContent>
        </Card>

        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p className="text-sm font-medium">{submitError}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="min-w-[160px] h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {submitting ? 'Submitting...' : 'Proceed to Payment'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default CheckoutDetailsPage
