import React from 'react'
import { formatUsd } from '@/lib/money'
import { Order } from '@/types/order'

interface OrderSummaryProps {
  order: Order
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ order }) => {
  const { totals } = order

  return (
    <aside aria-labelledby="order-summary-title" className="h-fit bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 id="order-summary-title" className="text-lg font-semibold text-gray-900 mb-4">
        Order summary
      </h2>
      <ul className="max-h-72 overflow-auto divide-y divide-gray-100 mb-4">
        {order.products.map(({ product, amount, price }) => (
          <li key={product.id} className="flex justify-between gap-4 py-2 text-sm">
            <span className="text-gray-700">{product.title}</span>
            <span className="whitespace-nowrap text-gray-600">
              {amount} × {formatUsd(price)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-gray-200 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">Subtotal</dt>
          <dd className="text-gray-900">{formatUsd(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-gray-600">Discount</dt>
            <dd className="text-green-700">−{formatUsd(totals.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <dt className="text-gray-900">Total</dt>
          <dd className="text-gray-900">{formatUsd(totals.total)}</dd>
        </div>
      </dl>
    </aside>
  )
}

export default OrderSummary
