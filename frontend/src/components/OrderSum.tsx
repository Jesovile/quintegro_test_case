import React from 'react'
import { formatUsd } from '@/lib/money'
import { Order } from '@/types/order'

interface OrderSumProps {
  order: Order
}

const OrderSum: React.FC<OrderSumProps> = ({ order }) => {
  const { promo, promoActive, totals } = order

  return (
    <div className="bg-blue-600 text-white p-6 mt-6 rounded-lg shadow-md">
      {promo && (
        <p className="mb-1 text-sm text-blue-100">
          Promo {promo.id}
          {promoActive && totals.discount > 0 ? `: −${formatUsd(totals.discount)}` : promoActive ? '' : ' (expired)'}
        </p>
      )}
      <h3 className="text-xl font-bold">
        Order Total: {formatUsd(totals.total)}
      </h3>
    </div>
  )
}

export default OrderSum
