import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '../utils/formatCurrency'

interface Product {
  id: string
  title: string
  description: string
  image: string
}

interface OrderItem {
  product: Product
  amount: number
  price: number
}

interface DeliveryAddress {
  recipientName: string
  phone: string
  country: string
  city: string
  street: string
  building: string
  apartment?: string
  postalCode: string
}

interface DeliveryMethodSnapshot {
  type: 'regular' | 'extra'
  fee: number
  estimatedDays: string
}

interface PaymentSummary {
  paymentId: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  cardLast4: string
  cardholderName: string
  failureReason?: string
  createdAt: number
}

// Order shape this component needs — a subset of OrderDTO/GraphQL Order.
// deliveryAddress/deliveryMethod/payment/total are optional because legacy
// seed orders (order-1) predate the checkout epic and never had them set
// (tech-design.md §2.1) — every field here is rendered defensively.
export interface OrderHistoryOrder {
  orderId: string
  status: 'paid' | 'cancelled' | 'submited' | 'finished'
  products: OrderItem[]
  deliveryAddress?: DeliveryAddress | null
  deliveryMethod?: DeliveryMethodSnapshot | null
  payment?: PaymentSummary | null
  total?: number
}

// Prop contract pinned by plan review (implementation-plan-05.md iteration
// 5.2, N1; wired up by implementation-plan-06.md iteration 6.4):
// OrderList.tsx owns useMutation(CANCEL_ORDER) and passes these down,
// matching the existing handleDelete/handleAmountChange prop-drilling
// convention. This component does NOT call useMutation itself — it only
// renders the "Cancel Order" button and calls the passed-in onCancel.
export interface OrderHistoryItemProps {
  order: OrderHistoryOrder
  onCancel?: (orderId: string) => void
  cancelling?: boolean
  cancelError?: string
}

const STATUS_LABELS: Record<OrderHistoryOrder['status'], string> = {
  paid: 'Paid',
  cancelled: 'Cancelled',
  submited: 'Submitted',
  finished: 'Finished'
}

const STATUS_BADGE_VARIANT: Record<OrderHistoryOrder['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  cancelled: 'destructive',
  submited: 'secondary',
  finished: 'outline'
}

const DELIVERY_METHOD_LABELS: Record<DeliveryMethodSnapshot['type'], string> = {
  regular: 'Regular',
  extra: 'Extra'
}

const PAYMENT_STATUS_LABELS: Record<PaymentSummary['status'], string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Paid',
  failed: 'Failed'
}

// Read-only rendering of a paid/cancelled/submited/finished order — no
// quantity +/- controls, no delete button, ever (tech-design.md §4.6 / AC-503-1).
// The only interactive control is the "Cancel Order" button (paid orders only).
const OrderHistoryItem: React.FC<OrderHistoryItemProps> = ({ order, onCancel, cancelling, cancelError }) => {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Badge variant={STATUS_BADGE_VARIANT[order.status]} data-testid="order-status-badge">
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {order.products.map(item => (
        <Card key={item.product.id} className="mb-4 border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20 rounded-lg border border-gray-200">
                <AvatarImage src={item.product.image} alt={item.product.title} />
                <AvatarFallback className="text-lg font-semibold bg-gray-100 text-gray-600">
                  {item.product.title.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">{item.product.title}</h3>
                <p className="text-sm text-gray-600">{item.product.description}</p>
                <p className="text-sm text-gray-600 mt-1">Qty: {item.amount}</p>
              </div>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(item.price)}</p>
            </div>
          </CardContent>
        </Card>
      ))}

      {order.deliveryAddress && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mt-2 mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Delivery address</h4>
          <p className="text-gray-900 font-medium">{order.deliveryAddress.recipientName}</p>
          <p className="text-gray-600 text-sm">{order.deliveryAddress.phone}</p>
          <p className="text-gray-600 text-sm">
            {order.deliveryAddress.street} {order.deliveryAddress.building}
            {order.deliveryAddress.apartment ? `, apt ${order.deliveryAddress.apartment}` : ''}
          </p>
          <p className="text-gray-600 text-sm">
            {order.deliveryAddress.city}, {order.deliveryAddress.country} {order.deliveryAddress.postalCode}
          </p>
        </div>
      )}

      {order.deliveryMethod && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Delivery method</h4>
          <p className="text-gray-900 font-medium">{DELIVERY_METHOD_LABELS[order.deliveryMethod.type]}</p>
          <p className="text-sm text-gray-600">{order.deliveryMethod.estimatedDays} days &middot; {formatCurrency(order.deliveryMethod.fee)}</p>
        </div>
      )}

      {order.payment && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Payment status</h4>
          <p className="text-gray-900 font-medium">{PAYMENT_STATUS_LABELS[order.payment.status]}</p>
          {order.payment.failureReason && (
            <p className="text-sm text-red-600 mt-1">{order.payment.failureReason}</p>
          )}
        </div>
      )}

      {typeof order.total === 'number' && (
        <div className="bg-blue-600 text-white p-6 mb-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold">Total: {formatCurrency(order.total)}</h3>
        </div>
      )}

      {/* AC-601-1/AC-601-3: pure function of status, gated on onCancel being
          provided (parent-owns-the-mutation shape, tech-design.md §4.6).
          AC-601's out-of-scope note is explicit: no confirmation dialog. */}
      {order.status === 'paid' && onCancel && (
        <div>
          <Button
            variant="destructive"
            onClick={() => onCancel(order.orderId)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </Button>
          {cancelError && (
            <p className="text-sm text-red-600 mt-2" role="alert">
              {cancelError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default OrderHistoryItem
