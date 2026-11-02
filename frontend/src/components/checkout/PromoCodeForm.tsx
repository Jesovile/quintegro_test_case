import React, { useEffect, useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import { APPLY_PROMO, REMOVE_PROMO } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { Order } from '@/types/order'

const FIELD_ID = 'promo-code'

interface PromoCodeFormProps {
  order: Order
}

const PromoCodeForm: React.FC<PromoCodeFormProps> = ({ order }) => {
  const [code, setCode] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)

  // Failures are shown from the mutation state below
  const [applyPromo, applyState] = useMutation(APPLY_PROMO, { onCompleted: () => setCode(''), onError: () => undefined })
  const removedByUser = useRef(false)
  const [removePromo, removeState] = useMutation(REMOVE_PROMO, {
    onError: () => {
      removedByUser.current = false
    }
  })

  // Set before the request: Apollo re-renders with the updated order before onCompleted runs
  const handleRemove = () => {
    removedByUser.current = true
    removePromo({ variables: { orderId: order.orderId } })
  }

  // After "Remove" the button disappears; keep keyboard users in place by focusing the code field once it is back
  useEffect(() => {
    if (removedByUser.current && !order.promo) {
      removedByUser.current = false
      document.getElementById(FIELD_ID)?.focus()
    }
  }, [order.promo])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setInputError('Enter a promo code')
      document.getElementById(FIELD_ID)?.focus()
      return
    }
    setInputError(null)
    applyPromo({ variables: { orderId: order.orderId, code } })
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCode(event.target.value)
    // An error about the previous code no longer applies
    setInputError(null)
    applyState.reset()
  }

  const error = inputError ?? (applyState.error ? getErrorMessage(applyState.error) : null)
  const { promo } = order

  return (
    <section aria-labelledby="promo-title" className="mb-6">
      <h3 id="promo-title" className="mb-2 text-base font-semibold text-gray-900">
        Promo code
      </h3>
      {promo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-sm text-gray-700">
            <span className="font-medium">{promo.id}</span>{' '}
            {order.promoActive ? `applied: ${promo.discount}% off` : 'has expired and no longer applies'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="min-w-[5rem]"
            aria-label={`Remove promo code ${promo.id}`}
            loading={removeState.loading}
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="flex flex-wrap items-start gap-3">
          <FormField id={FIELD_ID} label="Code" error={error ?? undefined} announceError className="min-w-[12rem] flex-1">
            <Input
              id={FIELD_ID}
              value={code}
              onChange={handleChange}
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${FIELD_ID}-error` : undefined}
            />
          </FormField>
          <Button type="submit" variant="outline" className="mt-6 min-w-[5rem]" loading={applyState.loading}>
            Apply
          </Button>
        </form>
      )}
      {removeState.error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {getErrorMessage(removeState.error)}
        </p>
      )}
    </section>
  )
}

export default PromoCodeForm
