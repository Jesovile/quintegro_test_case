import React from 'react'
import { useMutation } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { RETRY_PROCESSING } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { Order } from '@/types/order'

interface ProcessingStepProps {
  order: Order
}

// The controller keeps the order fresh; this step only shows progress and offers a retry after a failure
const ProcessingStep: React.FC<ProcessingStepProps> = ({ order }) => {
  const [retryProcessing, retryState] = useMutation(RETRY_PROCESSING, { onError: () => undefined })

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 id="checkout-step-title" className="text-xl font-semibold text-gray-900 mb-2">
        Processing
      </h2>
      {order.processingFailed ? (
        <div role="alert">
          <p className="text-gray-700">
            We could not prepare order #{order.orderId} for delivery. Your payment is safe; please try again.
          </p>
          {retryState.error && <p className="mt-2 text-sm text-red-600">{getErrorMessage(retryState.error)}</p>}
          <Button
            className="mt-4 min-w-[7rem]"
            loading={retryState.loading}
            onClick={() => retryProcessing({ variables: { orderId: order.orderId } })}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-gray-700">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
          <p>
            Payment received. We are preparing order #{order.orderId} for delivery. This page updates automatically, and
            you can safely close it.
          </p>
        </div>
      )}
    </div>
  )
}

export default ProcessingStep
