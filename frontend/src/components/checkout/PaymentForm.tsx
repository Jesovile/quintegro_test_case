import React, { useState } from 'react'
import { Input } from '../ui/input'

interface Props { onSubmit: (cardNumber: string, cvv: string) => void; disabled: boolean }

const PaymentForm: React.FC<Props> = ({ onSubmit, disabled }) => {
  const [cardNumber, setCardNumber] = useState('')
  const [cvv, setCvv] = useState('')
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Payment</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <Input aria-label="Card number" inputMode="numeric" autoComplete="cc-number" placeholder="Card number" value={cardNumber} onChange={event => setCardNumber(event.target.value)} />
      <Input aria-label="CVV" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV" type="password" value={cvv} onChange={event => setCvv(event.target.value)} />
    </div>
    <button type="button" disabled={disabled} onClick={() => onSubmit(cardNumber, cvv)} className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50">
      {disabled ? 'Processing…' : 'Pay and place order'}
    </button>
  </section>
}

export default PaymentForm
