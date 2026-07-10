import React from 'react'
import { formatCurrency } from '../../utils/formatCurrency'
import { DeliveryAddress, DeliveryMethodType } from '../../context/CheckoutContext'

export interface OrderReviewProduct {
  product: { id: string; title: string; image: string }
  amount: number
  price: number
}

export interface OrderReviewDeliveryMethod {
  type: DeliveryMethodType
  fee: number
  estimatedDays: string
}

export interface OrderReviewSummaryProps {
  products: OrderReviewProduct[]
  deliveryAddress: DeliveryAddress
  deliveryMethod: OrderReviewDeliveryMethod
  total: number
}

const METHOD_LABELS: Record<DeliveryMethodType, string> = {
  regular: 'Regular',
  extra: 'Extra'
}

// Pure presentational component — no GraphQL/Apollo dependency. Renders the
// server-computed `total` verbatim (tech-design.md §4.3): no arithmetic is
// performed here, so a promo discount applied server-side is never silently
// dropped by a client-side `subtotal + fee` shadow calculation.
const OrderReviewSummary: React.FC<OrderReviewSummaryProps> = ({
  products,
  deliveryAddress,
  deliveryMethod,
  total
}) => {
  return (
    <div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
        <ul className="divide-y divide-gray-200">
          {products.map(item => (
            <li key={item.product.id} className="py-3 flex items-center gap-4">
              <img src={item.product.image} alt={item.product.title} className="h-12 w-12 object-cover rounded" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.product.title}</p>
                <p className="text-sm text-gray-600">Qty: {item.amount}</p>
              </div>
              <p className="font-medium text-gray-900">{formatCurrency(item.price)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery address</h2>
        <p className="text-gray-900 font-medium">{deliveryAddress.recipientName}</p>
        <p className="text-gray-600">{deliveryAddress.phone}</p>
        <p className="text-gray-600">
          {deliveryAddress.street} {deliveryAddress.building}
          {deliveryAddress.apartment ? `, apt ${deliveryAddress.apartment}` : ''}
        </p>
        <p className="text-gray-600">
          {deliveryAddress.city}, {deliveryAddress.country} {deliveryAddress.postalCode}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery method</h2>
        <p className="text-gray-900 font-medium">{METHOD_LABELS[deliveryMethod.type]}</p>
        <p className="text-sm text-gray-600">{deliveryMethod.estimatedDays} days</p>
        <p className="text-gray-900 font-medium mt-1">{formatCurrency(deliveryMethod.fee)}</p>
      </div>

      <div className="bg-blue-600 text-white p-6 mt-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold">Order Total: {formatCurrency(total)}</h3>
      </div>
    </div>
  )
}

export default OrderReviewSummary
