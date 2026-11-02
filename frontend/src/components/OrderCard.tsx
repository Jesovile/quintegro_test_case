import React from 'react'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import CheckoutAction from './CheckoutAction'
import CancelOrderDialog from './CancelOrderDialog'
import { ORDER_STATUS_LABELS, isEditableOrder } from '@/lib/orderStatus'
import { Order } from '@/types/order'

interface OrderCardProps {
  order: Order
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => (
  <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h2 className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
      Order #{order.orderId} - {ORDER_STATUS_LABELS[order.status]}
    </h2>

    {order.products.map((item) => (
      <OrderListItem key={item.product.id} item={item} orderId={order.orderId} editable={isEditableOrder(order.status)} />
    ))}
    {order.products.length === 0 && <p className="text-center py-6 text-gray-600">This order is empty.</p>}
    <OrderSum order={order} />
    <div className="mt-4 flex flex-wrap justify-end gap-3">
      <CancelOrderDialog order={order} />
    </div>
    <CheckoutAction order={order} />
  </div>
)

export default OrderCard
