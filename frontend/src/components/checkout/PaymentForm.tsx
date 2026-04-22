import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface CardDraft {
  number: string
  holderName: string
  expiryMonth: number
  expiryYear: number
  cvv: string
}

interface Props {
  initial?: CardDraft | null
  onBack: () => void
  onSubmit: (card: CardDraft) => void
  onCancel: () => void
}

const EMPTY_FORM = {
  number: '',
  holderName: '',
  expiry: '',
  cvv: ''
}

const luhn = (digits: string): boolean => {
  if (!/^\d+$/.test(digits) || digits.length < 12) return false
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

const parseExpiry = (value: string): { month: number; year: number } | null => {
  const m = value.match(/^(\d{2})\s*\/\s*(\d{2})$/)
  if (!m) return null
  const month = parseInt(m[1], 10)
  const year = 2000 + parseInt(m[2], 10)
  if (month < 1 || month > 12) return null
  return { month, year }
}

const isExpiryFuture = (month: number, year: number): boolean => {
  const now = new Date()
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  return endOfMonth.getTime() >= now.getTime()
}

const PaymentForm: React.FC<Props> = ({ initial, onBack, onSubmit, onCancel }) => {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM
    const mm = String(initial.expiryMonth).padStart(2, '0')
    const yy = String(initial.expiryYear % 100).padStart(2, '0')
    return {
      number: initial.number,
      holderName: initial.holderName,
      expiry: `${mm}/${yy}`,
      cvv: initial.cvv
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    const digits = form.number.replace(/\s+/g, '')
    if (!digits) next.number = 'Required'
    else if (!luhn(digits) && !digits.startsWith('0000')) next.number = 'Invalid card number'

    if (!form.holderName.trim()) next.holderName = 'Required'

    const expiry = parseExpiry(form.expiry)
    if (!expiry) next.expiry = 'Format MM/YY'
    else if (!isExpiryFuture(expiry.month, expiry.year)) next.expiry = 'Card expired'

    if (!/^\d{3,4}$/.test(form.cvv)) next.cvv = '3 or 4 digits'

    setErrors(next)
    if (Object.keys(next).length > 0 || !expiry) return

    onSubmit({
      number: digits,
      holderName: form.holderName.trim(),
      expiryMonth: expiry.month,
      expiryYear: expiry.year,
      cvv: form.cvv
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold mb-2 text-gray-900">Payment</h2>
      <p className="text-sm text-gray-500 mb-6">
        Mock payment. Any valid card works. Use a number starting with <code>0000</code> to simulate a decline.
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Card number</label>
          <Input
            value={form.number}
            onChange={handleChange('number')}
            placeholder="4242 4242 4242 4242"
            inputMode="numeric"
            className="h-10"
          />
          {errors.number && <p className="text-xs text-red-600">{errors.number}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Cardholder name</label>
          <Input
            value={form.holderName}
            onChange={handleChange('holderName')}
            placeholder="Jane Doe"
            className="h-10"
          />
          {errors.holderName && <p className="text-xs text-red-600">{errors.holderName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Expiry (MM/YY)</label>
            <Input
              value={form.expiry}
              onChange={handleChange('expiry')}
              placeholder="12/30"
              className="h-10"
            />
            {errors.expiry && <p className="text-xs text-red-600">{errors.expiry}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">CVV</label>
            <Input
              value={form.cvv}
              onChange={handleChange('cvv')}
              placeholder="123"
              inputMode="numeric"
              className="h-10"
            />
            {errors.cvv && <p className="text-xs text-red-600">{errors.cvv}</p>}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="text-red-600 hover:bg-red-50"
        >
          Cancel order
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
            Next: Confirm
          </Button>
        </div>
      </div>
    </form>
  )
}

export default PaymentForm
