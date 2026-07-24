import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  isValidCardNumber,
  isValidExpiry,
  isValidCvc,
  isValidCardholderName,
} from '@/lib/cardValidation'

export interface CardPaymentValues {
  cardNumber: string
  cardExpiry: string
  cardCvc: string
  cardholderName: string
}

interface CardPaymentFormProps {
  onPay: (values: CardPaymentValues) => void
  submitting: boolean
}

const CardPaymentForm: React.FC<CardPaymentFormProps> = ({ onPay, submitting }) => {
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [cardholderName, setCardholderName] = useState('')

  const isFormValid =
    isValidCardNumber(cardNumber) &&
    isValidExpiry(cardExpiry) &&
    isValidCvc(cardCvc) &&
    isValidCardholderName(cardholderName)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    onPay({ cardNumber, cardExpiry, cardCvc, cardholderName })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="cardNumber">Card number</Label>
        <Input
          id="cardNumber"
          inputMode="numeric"
          placeholder="4242 4242 4242 4242"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
        />
        {cardNumber && !isValidCardNumber(cardNumber) && (
          <p className="text-sm text-red-600 mt-1">Enter a valid card number (digits only, 12-19 digits)</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cardExpiry">Expiry (MM/YY)</Label>
          <Input
            id="cardExpiry"
            placeholder="12/34"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(e.target.value)}
          />
          {cardExpiry && !isValidExpiry(cardExpiry) && (
            <p className="text-sm text-red-600 mt-1">Enter a valid, non-expired MM/YY date</p>
          )}
        </div>
        <div>
          <Label htmlFor="cardCvc">CVC</Label>
          <Input
            id="cardCvc"
            inputMode="numeric"
            placeholder="123"
            value={cardCvc}
            onChange={(e) => setCardCvc(e.target.value)}
          />
          {cardCvc && !isValidCvc(cardCvc) && (
            <p className="text-sm text-red-600 mt-1">Enter a valid 3 or 4 digit CVC</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="cardholderName">Cardholder name</Label>
        <Input
          id="cardholderName"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isFormValid || submitting}
          className="min-w-[120px] h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {submitting ? 'Paying...' : 'Pay'}
        </Button>
      </div>
    </form>
  )
}

export default CardPaymentForm
