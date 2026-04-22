import React, { useState, useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { Order, isCurrent, isHistory, OrderStatus } from '../types/order'

type Mode = 'current' | 'history'

interface OrderListProps {
  mode: Mode
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Current',
  checkout: 'Checkout in progress',
  submited: 'Submitted',
  finished: 'Completed',
  canceled: 'Canceled'
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  created: 'bg-blue-100 text-blue-700',
  checkout: 'bg-amber-100 text-amber-700',
  submited: 'bg-green-100 text-green-700',
  finished: 'bg-gray-100 text-gray-700',
  canceled: 'bg-red-100 text-red-700'
}

const sortHistoryDesc = (a: Order, b: Order) => {
  const aTs = a.canceledAt ?? a.placedAt ?? a.createAt
  const bTs = b.canceledAt ?? b.placedAt ?? b.createAt
  return bTs - aTs
}

const formatTimestamp = (ts?: number | null) => {
  if (!ts) return null
  return new Date(ts).toLocaleString()
}

const OrderList: React.FC<OrderListProps> = ({ mode }) => {
  const [orders, setOrders] = useState<Order[]>([])
  const history = useHistory()

  const { loading, error } = useQuery(GET_ORDERS, {
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      setOrders(data.orders || [])
    },
    onError: (err) => {
      console.error('GraphQL error:', err)
    }
  })

  useEffect(() => {
    setOrders([])
  }, [mode])

  const filtered = orders
    .filter(mode === 'current' ? isCurrent : isHistory)
    .sort(mode === 'history' ? sortHistoryDesc : (a, b) => b.createAt - a.createAt)

  const handleAmountChange = (productId: string, newAmount: number) => {
    setOrders(prev =>
      prev.map(order => ({
        ...order,
        products: order.products.map(item =>
          item.product.id === productId ? { ...item, amount: newAmount } : item
        )
      }))
    )
  }

  const handleDelete = (productId: string) => {
    setOrders(prev =>
      prev
        .map(order => ({
          ...order,
          products: order.products.filter(item => item.product.id !== productId)
        }))
        .filter(order => order.products.length > 0)
    )
  }

  const goToCheckout = (orderId: string) => history.push(`/checkout/${orderId}`)

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <p className="text-sm font-medium">{error.message}</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {mode === 'current' ? 'No active orders' : 'No past orders'}
          </h2>
          <p className="mt-2 text-gray-600">
            {mode === 'current'
              ? "You don't have any active orders yet."
              : 'Your completed and canceled orders will appear here.'}
          </p>
        </div>
      </div>
    )
  }

  const readOnly = mode === 'history'

  return (
    <div>
      {filtered.map(order => {
        const showCheckoutCta = mode === 'current' && (order.status === 'created' || order.status === 'checkout')
        const historyTs = order.canceledAt ?? order.placedAt ?? order.createAt

        return (
          <div
            key={order.orderId}
            className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-3">
              <h2 className="text-xl font-semibold text-gray-900">
                Order #{order.orderId}
              </h2>
              <span className={`text-xs font-medium px-2 py-1 rounded ${STATUS_BADGE[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            {readOnly && (
              <p className="text-sm text-gray-500 mb-4">
                {order.status === 'canceled' ? 'Canceled' : 'Placed'} on {formatTimestamp(historyTs)}
              </p>
            )}

            {order.products.map((item, index) => (
              <OrderListItem
                key={item.product.id}
                product={item.product}
                amount={item.amount}
                price={item.price}
                orderId={order.orderId}
                onAmountChange={handleAmountChange}
                onDelete={handleDelete}
                readOnly={readOnly}
                isLast={index === order.products.length - 1}
              />
            ))}

            <OrderSum orderId={order.orderId} products={order.products} />

            {showCheckoutCta && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => goToCheckout(order.orderId)}
                  className="min-w-[160px] h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {order.status === 'checkout' ? 'Resume Checkout' : 'Proceed to Checkout'}
                </Button>
              </div>
            )}

            {readOnly && order.shipping && (
              <div className="mt-6 text-sm text-gray-600 border-t border-gray-200 pt-4">
                <p className="font-medium text-gray-800 mb-1">Shipping</p>
                <p>{order.shipping.fullName}</p>
                <p>{order.shipping.address}, {order.shipping.city}, {order.shipping.zip}, {order.shipping.country}</p>
                <p>{order.shipping.phone}</p>
              </div>
            )}

            {readOnly && order.payment && (
              <div className="mt-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-1">Payment</p>
                <p>
                  {order.payment.brand.toUpperCase()} •••• {order.payment.last4} ({order.payment.holderName})
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default OrderList
