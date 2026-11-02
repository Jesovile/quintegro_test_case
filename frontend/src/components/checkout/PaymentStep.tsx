import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/state-views'
import { usePaymentForm } from '@/hooks/usePaymentForm'
import { usePayOrder } from '@/hooks/usePayOrder'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { formatUsd } from '@/lib/money'
import { Order } from '@/types/order'
import CardFields from './CardFields'
import PromoCodeForm from './PromoCodeForm'

interface PaymentStepProps {
  order: Order
  onPaid: () => void
}

const PaymentStep: React.FC<PaymentStepProps> = ({ order, onPaid }) => {
  const form = usePaymentForm()
  const payment = usePayOrder(order, onPaid)
  const { cardNumber, expiry, cvc } = form.values
  const { forgetCard } = payment

  // Editing the card means a retry must not reuse the token of the previous card
  useEffect(() => {
    forgetCard()
    // forgetCard only clears state; re-running on its identity is not needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardNumber, expiry, cvc])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (form.validate()) {
      payment.submit(form.values)
    }
  }

  const { error, busy, awaitingConfirmation } = payment

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 id="checkout-step-title" className="text-xl font-semibold text-gray-900 mb-4">
        Payment
      </h2>
      <PromoCodeForm order={order} />

      <form noValidate onSubmit={handleSubmit}>
        <CardFields errors={form.errors} fieldProps={form.fieldProps} readOnly={awaitingConfirmation || busy} />

        {payment.tokenError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {payment.tokenError}
          </p>
        )}
        {error && !busy &&
          (payment.canRetry ? (
            <ErrorState message={getErrorMessage(error)} onRetry={payment.retry} />
          ) : (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {getErrorMessage(error)}
            </p>
          ))}

        {/* Until an unanswered payment is checked, only "Try again" is offered: a new card could be charged twice */}
        {!awaitingConfirmation && (
          <div className="flex justify-end">
            <Button type="submit" loading={busy} className="min-w-[10rem] bg-blue-600 hover:bg-blue-700 text-white">
              Pay {formatUsd(order.totals.total)}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}

export default PaymentStep
