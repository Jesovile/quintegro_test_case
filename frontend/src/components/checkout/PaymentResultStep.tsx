import React from 'react'
import { Button } from '../ui/button'

interface Props {
  status: 'inProgress' | 'failed'
  onClose: () => void
}

const PaymentResultStep: React.FC<Props> = ({ status, onClose }) => {
  const isSuccess = status === 'inProgress'

  return (
    <div className="flex flex-col items-center gap-5 text-center py-2">
      {isSuccess ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment successful</h3>
            <p className="mt-1 text-sm text-gray-600">
              Your order has been accepted. We will contact you to confirm delivery details.
            </p>
          </div>
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            Order status: <span className="font-semibold">In Progress</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment declined</h3>
            <p className="mt-1 text-sm text-gray-600">
              The bank declined the payment. Please contact support or try a different card.
            </p>
          </div>
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            Order status: <span className="font-semibold">Failed</span>
          </div>
        </>
      )}

      <Button onClick={onClose} className="mt-2 w-full">
        Close
      </Button>
    </div>
  )
}

export default PaymentResultStep
