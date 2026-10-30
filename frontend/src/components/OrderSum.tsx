import React from 'react'
import { formatUsd } from '@/lib/money'
import { OrderTotals } from '@/types/order'

interface OrderSumProps {
  totals: OrderTotals
}

const OrderSum: React.FC<OrderSumProps> = ({ totals }) => (
  <div className="bg-blue-600 text-white p-6 mt-6 rounded-lg shadow-md">
    <h3 className="text-xl font-bold">
      Order Total: {formatUsd(totals.total)}
    </h3>
  </div>
)

export default OrderSum
