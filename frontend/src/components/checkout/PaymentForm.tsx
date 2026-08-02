import React, { useState } from 'react'
import { Input } from '../ui/input'
import { validateMockPaymentDetails } from '../../lib/mockPaymentTokenizer'

interface Props {
  onSubmit: (cardNumber: string, cvv: string) => void
  disabled: boolean
  quoteLoading: boolean
  submitting: boolean
}

const PaymentForm: React.FC<Props> = ({ onSubmit, disabled, quoteLoading, submitting }) => {
  const [cardNumber, setCardNumber] = useState('')
  const [cvv, setCvv] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const buttonLabel = submitting ? 'Processing…' : quoteLoading ? 'Updating quote…' : disabled ? 'Complete delivery details' : 'Pay and place order'
  const validationErrors = validateMockPaymentDetails(cardNumber, cvv)
  const cardNumberError = showValidation ? validationErrors.cardNumber : undefined
  const cvvError = showValidation ? validationErrors.cvv : undefined

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowValidation(true)
    if (validationErrors.cardNumber || validationErrors.cvv) return
    onSubmit(cardNumber, cvv)
  }

  return <form className="space-y-4" noValidate onSubmit={handleSubmit}>
    <h2 className="text-xl font-semibold">Payment</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1" htmlFor="card-number">
        <span>Card number <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="card-number" inputMode="numeric" autoComplete="cc-number" placeholder="Card number" value={cardNumber} onChange={event => setCardNumber(event.target.value)} required aria-invalid={Boolean(cardNumberError)} aria-describedby={cardNumberError ? 'card-number-error' : undefined} className={cardNumberError ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {cardNumberError && <p id="card-number-error" role="alert" className="text-sm text-red-600">{cardNumberError}</p>}
      </label>
      <label className="space-y-1" htmlFor="card-cvv">
        <span>CVV <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="card-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" type="password" value={cvv} onChange={event => setCvv(event.target.value)} required aria-invalid={Boolean(cvvError)} aria-describedby={cvvError ? 'card-cvv-error' : undefined} className={cvvError ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
        {cvvError && <p id="card-cvv-error" role="alert" className="text-sm text-red-600">{cvvError}</p>}
      </label>
    </div>
    <button type="submit" disabled={disabled} className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50">
      {buttonLabel}
    </button>
  </form>
}

export default PaymentForm
