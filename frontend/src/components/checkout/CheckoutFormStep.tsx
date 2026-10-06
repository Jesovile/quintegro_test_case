import React from 'react'
import { useMutation } from '@apollo/client'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { CHECKOUT } from './mutations'

export interface CheckoutFormData {
  address: string
  phone: string
  deliveryAt: string
  comment: string
}

export const EMPTY_FORM: CheckoutFormData = { address: '', phone: '', deliveryAt: '', comment: '' }

interface Props {
  orderId: string
  formData: CheckoutFormData
  onChange: (data: CheckoutFormData) => void
  onSuccess: (result: { paymentId: string; paymentUrl: string }) => void
  onCancel: () => void
}

const minDeliveryDate = (): string => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString().slice(0, 16)
}

const CheckoutFormStep: React.FC<Props> = ({ orderId, formData, onChange, onSuccess, onCancel }) => {
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const [checkout, { loading, error }] = useMutation(CHECKOUT, {
    onCompleted: (data) => onSuccess(data.checkout),
  })

  const set = (key: keyof CheckoutFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...formData, [key]: e.target.value })

  const validate = (): string | null => {
    if (formData.address.trim().length < 5) return 'Address must be at least 5 characters'
    const digits = formData.phone.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 15) return 'Phone must contain 10–15 digits'
    if (!formData.deliveryAt) return 'Please select a delivery date'
    if (new Date(formData.deliveryAt) <= new Date()) return 'Delivery date must be in the future'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)

    await checkout({
      variables: {
        orderId,
        input: {
          address: formData.address.trim(),
          phone: formData.phone,
          deliveryAt: new Date(formData.deliveryAt).toISOString(),
          comment: formData.comment || undefined,
        },
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery address *</label>
        <Input
          placeholder="123 Main St, New York, NY 10001"
          value={formData.address}
          onChange={set('address')}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contact phone *</label>
        <Input
          placeholder="+1 (999) 123-4567"
          type="tel"
          value={formData.phone}
          onChange={set('phone')}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expected delivery date *</label>
        <Input
          type="datetime-local"
          min={minDeliveryDate()}
          value={formData.deliveryAt}
          onChange={set('deliveryAt')}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Order comment</label>
        <textarea
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          rows={3}
          placeholder="Leave at the door, intercom code 1234..."
          value={formData.comment}
          onChange={set('comment')}
          disabled={loading}
        />
      </div>

      {(validationError || error) && (
        <p className="text-sm text-red-600">{validationError ?? error?.message}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Processing...' : 'Proceed to payment →'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default CheckoutFormStep
