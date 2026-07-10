import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { CardInput } from '../../hooks/usePaymentAttempt'

export interface PaymentFormErrors {
  cardNumber?: string
  expiry?: string
  cvv?: string
  cardholderName?: string
}

interface PaymentFormProps {
  onSubmit: (card: CardInput) => void
  disabled: boolean
}

const EMPTY_CARD: CardInput = {
  cardNumber: '',
  expiry: '',
  cvv: '',
  cardholderName: ''
}

// Client-side format validation (AC-401-2/3) — a no-op on failure, never
// fires the network call, so no partial PaymentRecord is created for a pure
// format error (tech-design.md §4.4).
function validate(card: CardInput): PaymentFormErrors {
  const errors: PaymentFormErrors = {}

  const normalizedNumber = card.cardNumber.replace(/\s+/g, '')
  if (!/^\d{13,19}$/.test(normalizedNumber)) {
    errors.cardNumber = 'Enter a valid card number (13-19 digits)'
  }

  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(card.expiry.trim())
  if (!expiryMatch) {
    errors.expiry = 'Enter expiry as MM/YY'
  } else {
    const month = parseInt(expiryMatch[1], 10)
    const year = 2000 + parseInt(expiryMatch[2], 10)
    if (month < 1 || month > 12) {
      errors.expiry = 'Enter expiry as MM/YY'
    } else {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        errors.expiry = 'Expiry date is in the past'
      }
    }
  }

  const normalizedCvv = card.cvv.replace(/\s+/g, '')
  if (!/^\d{3,4}$/.test(normalizedCvv)) {
    errors.cvv = 'Enter a valid CVV (3-4 digits)'
  }

  if (!card.cardholderName.trim()) {
    errors.cardholderName = 'Cardholder name is required'
  }

  return errors
}

// Fully controlled card-entry form (AC-401-1: all fields empty on mount).
// `disabled` (driven by usePaymentAttempt's `processing` phase) disables all
// inputs and the submit button (AC-402-1/402-2).
const PaymentForm: React.FC<PaymentFormProps> = ({ onSubmit, disabled }) => {
  const [card, setCard] = useState<CardInput>(EMPTY_CARD)
  const [touched, setTouched] = useState(false)

  const errors = validate(card)

  const handleChange = (field: keyof CardInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCard({ ...card, [field]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)

    if (Object.keys(errors).length > 0) {
      return
    }

    onSubmit(card)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Card number
        </label>
        <Input
          id="cardNumber"
          name="cardNumber"
          value={card.cardNumber}
          onChange={handleChange('cardNumber')}
          disabled={disabled}
          aria-invalid={!!(touched && errors.cardNumber)}
          placeholder="4242 4242 4242 4242"
        />
        {touched && errors.cardNumber && <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
            Expiry (MM/YY)
          </label>
          <Input
            id="expiry"
            name="expiry"
            value={card.expiry}
            onChange={handleChange('expiry')}
            disabled={disabled}
            aria-invalid={!!(touched && errors.expiry)}
            placeholder="09/27"
          />
          {touched && errors.expiry && <p className="mt-1 text-sm text-red-600">{errors.expiry}</p>}
        </div>

        <div>
          <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
            CVV
          </label>
          <Input
            id="cvv"
            name="cvv"
            value={card.cvv}
            onChange={handleChange('cvv')}
            disabled={disabled}
            aria-invalid={!!(touched && errors.cvv)}
            placeholder="123"
          />
          {touched && errors.cvv && <p className="mt-1 text-sm text-red-600">{errors.cvv}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-1">
          Cardholder name
        </label>
        <Input
          id="cardholderName"
          name="cardholderName"
          value={card.cardholderName}
          onChange={handleChange('cardholderName')}
          disabled={disabled}
          aria-invalid={!!(touched && errors.cardholderName)}
          placeholder="Jane Doe"
        />
        {touched && errors.cardholderName && <p className="mt-1 text-sm text-red-600">{errors.cardholderName}</p>}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled}>
          {disabled ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Pay'
          )}
        </Button>
      </div>
    </form>
  )
}

export default PaymentForm
