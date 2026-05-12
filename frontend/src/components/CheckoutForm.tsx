import React, { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDER } from '../graphql/queries'
import { SUBMIT_PAYMENT_INFO } from '../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface CheckoutFormProps {
  orderId: string
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ orderId }) => {
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const history = useHistory()

  const { loading: orderLoading } = useQuery(GET_ORDER, {
    variables: { orderId },
    onCompleted: (data) => {
      if (!data.order || data.order.status !== 'submited') {
        history.push('/order')
      }
    },
    onError: () => {
      history.push('/order')
    }
  })

  const [submitPayment, { loading: isSubmitting }] = useMutation(SUBMIT_PAYMENT_INFO, {
    onCompleted: () => {
      alert('Order checked out successfully!')
      history.push('/')
    },
    onError: (err) => {
      setError(err.message || 'Payment submission failed. Please try again.')
    }
  })

  const validate = (): string | null => {
    if (!phone.trim() || phone.trim().length < 7) {
      return 'Phone number must be at least 7 characters'
    }
    if (!address.trim() || address.trim().length < 5) {
      return 'Address must be at least 5 characters'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim() || !emailRegex.test(email.trim())) {
      return 'Please enter a valid email address'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      await submitPayment({
        variables: {
          input: { orderId, phone: phone.trim(), address: address.trim(), email: email.trim() }
        }
      })
    } catch (err) {
      // Error handled by onError callback
    }
  }

  if (orderLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-full py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-2xl font-semibold text-gray-900">
            Checkout — Order #{orderId}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone Number</label>
              <Input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Address</label>
              <Input
                type="text"
                placeholder="Enter your delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Purchase'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default CheckoutForm
