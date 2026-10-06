import React, { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Loader2, CreditCard, Lock } from 'lucide-react'
import { PAY } from './mutations'
import { GET_ENCRYPTION_KEY } from '../../graphql/queries'
import { encryptWithPublicKey } from '../../lib/crypto'

interface Props {
  paymentId: string
  paymentUrl: string
  onSuccess: (status: 'inProgress' | 'failed') => void
  onBack: () => void
}

interface CardForm {
  number: string
  expiry: string
  cvv: string
}

const EMPTY_CARD: CardForm = { number: '', expiry: '', cvv: '' }

const formatCardNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  if (digits.length === 2) return `${digits}/`
  return digits
}

const validateCard = (card: CardForm): string | null => {
  if (card.number.replace(/\D/g, '').length !== 16) return 'Enter a valid 16-digit card number'
  const [mm, yy] = card.expiry.split('/')
  const month = parseInt(mm, 10)
  const year = 2000 + parseInt(yy ?? '0', 10)
  const now = new Date()
  if (!mm || !yy || month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return 'Card has expired or expiry is invalid'
  }
  const cvvLen = card.cvv.replace(/\D/g, '').length
  if (cvvLen < 3 || cvvLen > 4) return 'Enter a valid CVV (3–4 digits)'
  return null
}

const PaymentStep: React.FC<Props> = ({ paymentId, onSuccess, onBack }) => {
  const [card, setCard] = useState<CardForm>(EMPTY_CARD)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [encrypting, setEncrypting] = useState(false)

  const { data: keyData, loading: keyLoading } = useQuery(GET_ENCRYPTION_KEY)

  const [pay, { loading: paying, error }] = useMutation(PAY, {
    onCompleted: (data) => {
      const status = data.pay.status as string
      onSuccess(status === 'inProgress' ? 'inProgress' : 'failed')
    },
  })

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCard(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))
  }

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw.length < card.expiry.length && raw.endsWith('/')) {
      setCard(prev => ({ ...prev, expiry: raw.slice(0, -1) }))
    } else {
      setCard(prev => ({ ...prev, expiry: formatExpiry(raw) }))
    }
  }

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCard(prev => ({ ...prev, cvv: digits }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateCard(card)
    if (err) { setValidationError(err); return }
    setValidationError(null)

    const publicKey = keyData?.encryptionPublicKey as string | undefined
    if (!publicKey) { setValidationError('Encryption key unavailable, please retry'); return }

    setEncrypting(true)
    let encrypted: string
    try {
      encrypted = await encryptWithPublicKey(publicKey, {
        number: card.number.replace(/\s/g, ''),
        expiry: card.expiry,
        cvv: card.cvv,
      })
    } catch {
      setValidationError('Failed to encrypt card data')
      setEncrypting(false)
      return
    }
    setEncrypting(false)

    await pay({ variables: { paymentId, card: { encrypted } } })
  }

  const loading = paying || encrypting
  const displayError = validationError ?? error?.message

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Lock className="h-4 w-4 text-green-600" />
        <span>Card data is encrypted end-to-end and never stored</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="card-number" className="text-sm font-medium text-gray-700">Card number</label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="card-number"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={card.number}
            onChange={handleNumberChange}
            className="pl-9"
            autoComplete="cc-number"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor="expiry" className="text-sm font-medium text-gray-700">Expiry</label>
          <Input
            id="expiry"
            inputMode="numeric"
            placeholder="MM/YY"
            value={card.expiry}
            onChange={handleExpiryChange}
            maxLength={5}
            autoComplete="cc-exp"
          />
        </div>
        <div className="flex flex-col gap-1.5 w-28">
          <label htmlFor="cvv" className="text-sm font-medium text-gray-700">CVV</label>
          <Input
            id="cvv"
            type="password"
            inputMode="numeric"
            placeholder="•••"
            value={card.cvv}
            onChange={handleCvvChange}
            maxLength={4}
            autoComplete="cc-csc"
          />
        </div>
      </div>

      {displayError && (
        <p className="text-sm text-red-600">{displayError}</p>
      )}

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-700">
          <span className="font-semibold">Mock mode:</span> every 3rd payment is intentionally declined.
          Use any 16-digit number with a future expiry.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || keyLoading} className="flex-1">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {encrypting ? 'Encrypting...' : 'Processing...'}
            </span>
          ) : (
            'Pay'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          Back
        </Button>
      </div>
    </form>
  )
}

export default PaymentStep
