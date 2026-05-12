import React, { useState } from 'react'
import { useMutation } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import { Loader2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { PAY_ORDER } from '@/graphql/mutations'
import { GET_ORDERS } from '@/graphql/queries'
import { paymentSchema, type PaymentInput } from '@/lib/checkoutSchemas'

interface PaymentStepProps {
  orderId: string
}

type FieldErrors = Partial<Record<'cardNumber' | 'cardholder' | 'cvv' | 'expiry', string>>

const formatCardNumber = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

const formatExpiry = (raw: string): string => {
  let digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length === 0) return ''

  // A single digit 2-9 can only be a month if prefixed with 0 — auto-prepend.
  if (digits.length === 1 && /[2-9]/.test(digits)) {
    digits = '0' + digits
  }

  // Constrain the two-digit month to 01-12; drop the offending digit otherwise.
  if (digits.length >= 2) {
    const month = parseInt(digits.slice(0, 2), 10)
    if (month < 1 || month > 12) {
      digits = digits[0]
    }
  }

  if (digits.length === 1) return digits
  if (digits.length === 2) return `${digits}/`
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

const PaymentStep: React.FC<PaymentStepProps> = ({ orderId }) => {
  const history = useHistory()

  const [cardNumber, setCardNumber] = useState('')
  const [cardholder, setCardholder] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [pay, { loading }] = useMutation(PAY_ORDER, {
    refetchQueries: [{ query: GET_ORDERS }],
    awaitRefetchQueries: false,
    onCompleted: () => {
      history.push(`/checkout/${orderId}/processing`)
    },
    onError: (e) => {
      setSubmitError(e.message)
    },
  })

  const clearError = (key: keyof FieldErrors) => {
    setSubmitError(null)
    setErrors((prev) => {
      if (prev[key] === undefined) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)

    const [mmStr, yyStr] = expiry.split('/')
    const expMonth = Number(mmStr)
    const yy = Number(yyStr)
    const expYear = yyStr && yyStr.length === 2 ? 2000 + yy : yy

    const payload: PaymentInput = {
      cardNumber,
      cardholder,
      cvv,
      expMonth: Number.isFinite(expMonth) ? expMonth : 0,
      expYear: Number.isFinite(expYear) ? expYear : 0,
    }

    const parsed = paymentSchema.safeParse(payload)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'cardNumber') next.cardNumber = issue.message
        else if (key === 'cardholder') next.cardholder = issue.message
        else if (key === 'cvv') next.cvv = issue.message
        else if (key === 'expMonth' || key === 'expYear') next.expiry = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    pay({
      variables: {
        input: {
          orderId,
          cardNumber: parsed.data.cardNumber.replace(/\s+/g, ''),
          cvv: parsed.data.cvv,
          cardholder: parsed.data.cardholder,
          expMonth: parsed.data.expMonth,
          expYear: parsed.data.expYear,
        },
      },
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Payment details</h2>
          </div>

          <div>
            <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Card number
            </label>
            <Input
              id="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => {
                setCardNumber(formatCardNumber(e.target.value))
                clearError('cardNumber')
              }}
              disabled={loading}
              aria-invalid={errors.cardNumber ? true : undefined}
              className={errors.cardNumber ? 'border-red-500 focus-visible:ring-red-500' : undefined}
            />
            {errors.cardNumber && <p className="mt-1 text-xs text-red-600">{errors.cardNumber}</p>}
            <p className="mt-1 text-xs text-gray-500">
              Test card:{' '}
              <button
                type="button"
                onClick={() => {
                  setCardNumber(formatCardNumber('4242424242424242'))
                  clearError('cardNumber')
                }}
                disabled={loading}
                className="font-mono text-blue-600 hover:underline disabled:opacity-50"
              >
                4242 4242 4242 4242
              </button>{' '}
              · any future MM/YY · any 3-digit CVV
            </p>
          </div>

          <div>
            <label htmlFor="cardholder" className="block text-sm font-medium text-gray-700 mb-1">
              Cardholder name
            </label>
            <Input
              id="cardholder"
              autoComplete="cc-name"
              placeholder="AS SHOWN ON CARD"
              value={cardholder}
              onChange={(e) => {
                setCardholder(e.target.value.toUpperCase())
                clearError('cardholder')
              }}
              disabled={loading}
              aria-invalid={errors.cardholder ? true : undefined}
              className={`uppercase ${errors.cardholder ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {errors.cardholder && <p className="mt-1 text-xs text-red-600">{errors.cardholder}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                Expiration (MM/YY)
              </label>
              <Input
                id="expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => {
                  setExpiry(formatExpiry(e.target.value))
                  clearError('expiry')
                }}
                disabled={loading}
                aria-invalid={errors.expiry ? true : undefined}
                className={errors.expiry ? 'border-red-500 focus-visible:ring-red-500' : undefined}
              />
              {errors.expiry && <p className="mt-1 text-xs text-red-600">{errors.expiry}</p>}
            </div>
            <div>
              <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                CVV
              </label>
              <Input
                id="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={cvv}
                onChange={(e) => {
                  setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                  clearError('cvv')
                }}
                disabled={loading}
                aria-invalid={errors.cvv ? true : undefined}
                className={errors.cvv ? 'border-red-500 focus-visible:ring-red-500' : undefined}
              />
              {errors.cvv && <p className="mt-1 text-xs text-red-600">{errors.cvv}</p>}
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => history.push(`/checkout/${orderId}/delivery`)}
          disabled={loading}
        >
          Back
        </Button>
        <Button type="submit" disabled={loading} className="min-w-[160px]">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting…
            </>
          ) : (
            'Place order'
          )}
        </Button>
      </div>
    </form>
  )
}

export default PaymentStep
