import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_CURRENT_CART, GET_DELIVERY_METHODS } from '../../graphql/queries'
import { SUBMIT_DELIVERY_DETAILS } from '../../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useCheckout, DeliveryAddress, DeliveryMethodType } from '../../context/CheckoutContext'
import DeliveryAddressForm, { DeliveryAddressErrors } from '../../components/checkout/DeliveryAddressForm'
import DeliveryMethodPicker from '../../components/checkout/DeliveryMethodPicker'

const EMPTY_ADDRESS: DeliveryAddress = {
  recipientName: '',
  phone: '',
  country: '',
  city: '',
  street: '',
  building: '',
  apartment: '',
  postalCode: ''
}

// Reasonable phone-shape validation per AC-201-3 — not exhaustive
// international validation, matches tech-design §4.2.
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/

function validate(address: DeliveryAddress): DeliveryAddressErrors {
  const errors: DeliveryAddressErrors = {}

  const requiredFields: Array<keyof DeliveryAddress> = [
    'recipientName',
    'phone',
    'country',
    'city',
    'street',
    'building',
    'postalCode'
  ]

  requiredFields.forEach(field => {
    if (!address[field] || !String(address[field]).trim()) {
      errors[field] = 'This field is required'
    }
  })

  if (address.phone && address.phone.trim() && !PHONE_REGEX.test(address.phone.trim())) {
    errors.phone = 'Enter a valid phone number'
  }

  return errors
}

// Feature 2 (delivery selection) replaces the "found-cart placeholder" block
// with the real DeliveryAddressForm/DeliveryMethodPicker content.
// This file owns the empty-cart / found-cart branching for US-102.
const CheckoutAddressPage: React.FC = () => {
  const history = useHistory()
  const { state, dispatch } = useCheckout()
  const { data, loading, error, refetch } = useQuery(GET_CURRENT_CART)
  const { data: methodsData, loading: methodsLoading, error: methodsError, refetch: refetchMethods } = useQuery(GET_DELIVERY_METHODS)

  const [address, setAddress] = useState<DeliveryAddress>(state.address ?? EMPTY_ADDRESS)
  const [methodType, setMethodType] = useState<DeliveryMethodType | null>(state.deliveryMethodType ?? null)
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Cross-feature integration-review fix: without this, GET_CURRENT_CART's
  // cache-first result on the next page (CheckoutReviewPage) would still miss
  // the deliveryAddress/deliveryMethod just written here, since `Order`'s
  // cache key (`orderId`) isn't one InMemoryCache normalizes automatically.
  const [submitDeliveryDetails, { loading: submitting }] = useMutation(SUBMIT_DELIVERY_DETAILS, {
    refetchQueries: [{ query: GET_CURRENT_CART }]
  })

  const cart = data?.currentCart

  useEffect(() => {
    if (cart?.orderId && cart.orderId !== state.orderId) {
      dispatch({ type: 'SET_ORDER_ID', orderId: cart.orderId })
    }
  }, [cart?.orderId, state.orderId, dispatch])

  const errors = validate(address)
  const hasErrors = Object.keys(errors).length > 0
  const canSubmit = methodType !== null && !hasErrors && !submitting

  const handleAddressChange = (next: DeliveryAddress) => {
    setTouched(true)
    setAddress(next)
  }

  const handleMethodSelect = (type: DeliveryMethodType) => {
    setTouched(true)
    setMethodType(type)
  }

  const handleSubmit = async () => {
    setTouched(true)
    setSubmitError(null)

    if (!canSubmit || !state.orderId || !methodType) {
      return
    }

    try {
      await submitDeliveryDetails({
        variables: {
          orderId: state.orderId,
          address,
          deliveryMethodType: methodType
        }
      })

      dispatch({ type: 'SET_DELIVERY', address, deliveryMethodType: methodType })
      dispatch({ type: 'SET_STEP', step: 'review' })
      history.push('/checkout/review')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save delivery details. Please try again.'
      setSubmitError(message)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading your cart...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <p className="text-sm font-medium">{error.message}</p>
        <Button className="mt-3" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!cart || cart.products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Your cart is empty
          </h2>
          <p className="mt-2 text-gray-600">
            Add products to your cart before starting checkout.
          </p>
          <Button className="mt-6" onClick={() => history.push('/order')}>
            Back to cart
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Delivery Details</h1>
      <p className="text-gray-600 mb-6">
        Cart found — order #{cart.orderId} with {cart.products.length} item(s).
      </p>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="text-sm font-medium">{submitError}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery address</h2>
        <DeliveryAddressForm
          value={address}
          onChange={handleAddressChange}
          errors={touched ? errors : {}}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery method</h2>
        {methodsLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-gray-600">Loading delivery options...</span>
          </div>
        )}
        {methodsError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p className="text-sm font-medium">{methodsError.message}</p>
            <Button className="mt-3" variant="outline" onClick={() => refetchMethods()}>
              Try again
            </Button>
          </div>
        )}
        {methodsData?.deliveryMethods && (
          <DeliveryMethodPicker
            options={methodsData.deliveryMethods}
            selected={methodType}
            onSelect={handleMethodSelect}
          />
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Saving...' : 'Continue to review'}
        </Button>
      </div>
    </div>
  )
}

export default CheckoutAddressPage
