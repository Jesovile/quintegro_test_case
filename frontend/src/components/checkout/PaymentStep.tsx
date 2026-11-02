import React from 'react'
import { Order } from '@/types/order'
import PromoCodeForm from './PromoCodeForm'

interface PaymentStepProps {
  order: Order
}

const PaymentStep: React.FC<PaymentStepProps> = ({ order }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h2 id="checkout-step-title" className="text-xl font-semibold text-gray-900 mb-4">
      Payment
    </h2>
    <PromoCodeForm order={order} />
    {/* Card details and the pay button are added in Slice 6 */}
    <p className="text-sm text-gray-600">Card details will be entered here.</p>
  </div>
)

export default PaymentStep
