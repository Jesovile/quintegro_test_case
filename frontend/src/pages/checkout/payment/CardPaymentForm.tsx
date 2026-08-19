import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardPaymentInput } from '@/types/checkout'

interface CardPaymentFormProps {
  onSubmit: (payload: CardPaymentInput) => void
  processing: boolean
}

const CardPaymentForm: React.FC<CardPaymentFormProps> = ({ onSubmit, processing }) => {
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [cvv, setCvv] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) {
      setValidationError('Проверьте номер карты.')
      return
    }
    const month = Number(expiryMonth)
    const year = Number(expiryYear)
    if (!month || month < 1 || month > 12 || !year) {
      setValidationError('Проверьте срок действия карты.')
      return
    }
    if (cvv.length < 3) {
      setValidationError('Проверьте CVV.')
      return
    }

    onSubmit({ cardNumber: digits, cardHolder, expiryMonth: month, expiryYear: year, cvv })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Номер карты</label>
        <Input
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="4242 4242 4242 4242"
          required
          disabled={processing}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Имя держателя</label>
        <Input
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value)}
          placeholder="IVAN IVANOV"
          required
          disabled={processing}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Месяц</label>
          <Input value={expiryMonth} onChange={(e) => setExpiryMonth(e.target.value)} placeholder="12" required disabled={processing} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Год</label>
          <Input value={expiryYear} onChange={(e) => setExpiryYear(e.target.value)} placeholder="2027" required disabled={processing} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">CVV</label>
          <Input
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            placeholder="123"
            required
            disabled={processing}
            type="password"
          />
        </div>
      </div>

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}

      <p className="text-xs text-gray-500">
        Тестовые карты: ...4242 успех, ...0002 отказ, ...0003 нет средств, ...0004 сервис недоступен, просроченный срок — карта истекла.
      </p>

      <Button type="submit" disabled={processing} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium">
        {processing ? 'Обрабатываем платёж...' : 'Оплатить'}
      </Button>
    </form>
  )
}

export default CardPaymentForm
