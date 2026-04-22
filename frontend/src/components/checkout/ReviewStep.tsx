import React from 'react'
import { Order } from '../../types/order'
import OrderSum from '../OrderSum'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface Props {
  order: Order
  onNext: () => void
  onCancel: () => void
}

const ReviewStep: React.FC<Props> = ({ order, onNext, onCancel }) => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 text-gray-900">Review your order</h2>

      <div className="space-y-4">
        {order.products.map(item => (
          <div
            key={item.product.id}
            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg"
          >
            <Avatar className="w-16 h-16 rounded-lg border border-gray-200">
              <AvatarImage src={item.product.image} alt={item.product.title} />
              <AvatarFallback>{item.product.title.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.product.title}</p>
              <p className="text-sm text-gray-500">Qty: {item.amount}</p>
            </div>
            <p className="text-blue-600 font-bold">${(item.amount * item.price).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <OrderSum orderId={order.orderId} products={order.products} />

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onCancel} className="text-red-600 hover:bg-red-50">
          Cancel order
        </Button>
        <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
          Next: Shipping
        </Button>
      </div>
    </div>
  )
}

export default ReviewStep
