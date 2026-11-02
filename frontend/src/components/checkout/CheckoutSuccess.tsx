import React from 'react'
import { CHECKOUT_STEP_HEADING_ID } from '@/lib/checkoutSteps'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/money'
import { Order } from '@/types/order'

interface CheckoutSuccessProps {
  order: Order
}

const CheckoutSuccess: React.FC<CheckoutSuccessProps> = ({ order }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm text-center">
    <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" aria-hidden="true" />
    <h2 id={CHECKOUT_STEP_HEADING_ID} tabIndex={-1} className="focus:outline-none mt-4 text-2xl font-semibold text-gray-900">
      Thank you for your order!
    </h2>
    <p className="mt-2 text-gray-700">
      Order <span className="font-medium">#{order.orderId}</span> is paid and on its way.
    </p>
    <p className="mt-1 text-gray-700">
      Total paid: <span className="font-medium">{formatUsd(order.totals.total)}</span>
    </p>
    <div className="mt-6 flex justify-center">
      <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
        <Link to="/">Continue shopping</Link>
      </Button>
    </div>
  </div>
)

export default CheckoutSuccess
