import React, { useRef } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
import { CANCEL_ORDER } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { getErrorMessage, isRetryable } from '@/lib/graphqlErrors'
import { canCancel, isRefundedOnCancel } from '@/lib/orderStatus'
import { formatUsd } from '@/lib/money'
import { Order } from '@/types/order'

interface CancelOrderDialogProps {
  order: Order
}

// A native <dialog>: modal, closes on Esc and returns focus to the button that opened it
const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({ order }) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const client = useApolloClient()
  const titleId = `cancel-order-${order.orderId}-title`

  const [cancelOrder, { loading, error, reset }] = useMutation(CANCEL_ORDER, {
    // Closed only once the order is really cancelled
    onCompleted: (data) => {
      if (data.cancelOrder.status === 'cancelled') {
        dialogRef.current?.close()
      }
    },
    // The order may have changed meanwhile (delivered, cancelled elsewhere): show its current state
    onError: () => {
      client.refetchQueries({ include: 'active' })
    }
  })

  if (!canCancel(order.status)) {
    return null
  }

  const open = () => {
    reset()
    dialogRef.current?.showModal()
  }
  const confirm = () => cancelOrder({ variables: { orderId: order.orderId } })

  return (
    <>
      <Button
        variant="outline"
        className="text-red-600 hover:bg-red-50"
        aria-label={`Cancel order #${order.orderId}`}
        onClick={open}
      >
        Cancel order
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Esc must not hide the dialog while the request runs: the user would not see the result
        onCancel={(event) => {
          if (loading) {
            event.preventDefault()
          }
        }}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-lg p-6 shadow-xl backdrop:bg-black/40"
      >
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          Cancel order #{order.orderId}?
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          {isRefundedOnCancel(order.status)
            ? `The order will be cancelled and ${formatUsd(order.totals.total)} refunded to your card.`
            : 'The order will be cancelled. You have not been charged.'}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {getErrorMessage(error)}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => dialogRef.current?.close()} disabled={loading}>
            Keep order
          </Button>
          <Button className="min-w-[8rem] bg-red-600 hover:bg-red-700 text-white" loading={loading} onClick={confirm}>
            {error && isRetryable(error) ? 'Try again' : 'Cancel order'}
          </Button>
        </div>
      </dialog>
    </>
  )
}

export default CancelOrderDialog
