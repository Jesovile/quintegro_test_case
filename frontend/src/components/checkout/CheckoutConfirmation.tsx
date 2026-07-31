import React from 'react'
import { CheckoutSnapshot } from '../../lib/checkoutTypes'

const CheckoutConfirmation: React.FC<{ checkout: CheckoutSnapshot }> = ({ checkout }) => <div className="mx-auto max-w-xl rounded-lg border border-green-200 bg-green-50 p-6">
  <h1 className="text-2xl font-bold text-green-900">Order placed</h1>
  <p className="mt-3">Payment: •••• {checkout.payment.last4}</p>
  <p>Payment reference: {checkout.payment.reference}</p>
  <p>Delivery reference: {checkout.delivery.reference}</p>
  <p>Estimated delivery: {new Date(checkout.delivery.estimatedDeliveryAt).toLocaleDateString('en-US')}</p>
</div>

export default CheckoutConfirmation
