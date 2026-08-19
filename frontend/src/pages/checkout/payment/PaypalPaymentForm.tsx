import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaypalPaymentInput } from '@/types/checkout'

interface PaypalPaymentFormProps {
  onSubmit: (payload: PaypalPaymentInput) => void
  processing: boolean
}

const PaypalPaymentForm: React.FC<PaypalPaymentFormProps> = ({ onSubmit, processing }) => {
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    if (!email.includes('@')) {
      setValidationError('Укажите корректный email аккаунта PayPal.')
      return
    }
    onSubmit({ email })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Email аккаунта PayPal</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={processing}
        />
      </div>

      {validationError && <p className="text-sm text-red-600">{validationError}</p>}

      <p className="text-xs text-gray-500">
        Тестовые адреса: с «decline» в адресе — отказ, с «error» — сервис недоступен, любой другой — успех.
      </p>

      <Button
        type="submit"
        disabled={processing}
        className="w-full h-11 bg-[#0070ba] hover:bg-[#005ea6] text-white font-medium"
      >
        {processing ? 'Переходим в PayPal...' : 'Войти и оплатить через PayPal'}
      </Button>
    </form>
  )
}

export default PaypalPaymentForm
