import React, { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import { CANCEL_ORDER } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
import OrderHistoryItem, { OrderHistoryOrder } from './OrderHistoryItem'
import OrderSum from './OrderSum'
import { Loader2 } from 'lucide-react'

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

// Extended by feature 5 (implementation-plan-05.md iteration 5.2/5.3) with
// deliveryAddress/deliveryMethod/payment/total/createAt so paid/cancelled
// orders can render their full detail block via OrderHistoryItem, and so the
// list can be sorted most-recent-first (AC-503-3).
interface Order {
  orderId: string
  status: 'created' | 'submited' | 'finished' | 'paid' | 'cancelled'
  products: OrderItem[]
  createAt: number
  deliveryAddress?: OrderHistoryOrder['deliveryAddress']
  deliveryMethod?: OrderHistoryOrder['deliveryMethod']
  payment?: OrderHistoryOrder['payment']
  total?: number
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  // Feature 6 (US-601): OrderList owns the cancel mutation (plan-review M1
  // architecture fix) — OrderHistoryItem only renders the button and calls
  // the onCancel prop. Tracked per-orderId so multiple history rows can be
  // in independent in-flight/error states.
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({})

  const { loading, error } = useQuery(GET_ORDERS, {
    onCompleted: (data) => {
      setOrders(data.orders || [])
    },
    onError: (error) => {
      console.error('GraphQL error:', error)
    }
  })

  const [cancelOrder] = useMutation(CANCEL_ORDER, {
    // Cross-feature integration-review fix: `Order`'s cache key is `orderId`,
    // not the `id`/`_id` Apollo's InMemoryCache normalizes by default, so a
    // status change here isn't auto-merged into the separately-cached
    // GET_ORDERS result. The onCompleted local-state update below covers this
    // mount; refetching keeps a later remount (e.g. navigating away and back)
    // from showing the pre-cancellation snapshot.
    refetchQueries: [{ query: GET_ORDERS }],
    onCompleted: (data) => {
      // Local-state update, matching deleteProductFromOrder's onCompleted
      // pattern above — avoids an extra round-trip through the
      // errorTestMiddleware/delayMiddleware chaos layer on every cancel click.
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.orderId === data.cancelOrder.orderId
            ? { ...order, status: data.cancelOrder.status }
            : order
        )
      )
      setCancellingOrderId(null)
      setCancelErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [data.cancelOrder.orderId]: _removed, ...rest } = prev
        return rest
      })
    },
    onError: (error, clientOptions) => {
      // AC-601-4: on failure the order's displayed status must stay
      // unchanged — we simply don't touch `orders` here, only record the
      // error so it can be shown inline via cancelError.
      const orderId = clientOptions?.variables?.orderId as string | undefined
      console.error('Failed to cancel order:', error)
      if (orderId) {
        setCancelErrors(prev => ({ ...prev, [orderId]: error.message }))
      }
      setCancellingOrderId(null)
    }
  })

  const handleCancel = (orderId: string) => {
    setCancellingOrderId(orderId)
    setCancelErrors(prev => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [orderId]: _removed, ...rest } = prev
      return rest
    })
    cancelOrder({ variables: { orderId } })
  }

  const handleAmountChange = (orderId: string, productId: string, newAmount: number) => {
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.orderId !== orderId
          ? order
          : {
              ...order,
              products: order.products.map(item =>
                item.product.id === productId
                  ? { ...item, amount: newAmount }
                  : item
              )
            }
      )
    )
  }

  const handleDelete = (orderId: string, productId: string) => {
    setOrders(prevOrders =>
      prevOrders
        .map(order =>
          order.orderId !== orderId
            ? order
            : { ...order, products: order.products.filter(item => item.product.id !== productId) }
        )
        .filter(order => order.orderId !== orderId || order.products.length > 0)
    )
  }

  if (loading) {
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
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            No orders found
          </h2>
          <p className="mt-2 text-gray-600">
            You don't have any orders yet.
          </p>
        </div>
      </div>
    )
  }

  // AC-503-3: most-recent-first — IOrderRepository.findByUserId returns
  // insertion order with no sort guarantee (tech-design.md §4.5 edge case),
  // so this is fixed client-side rather than in the repository layer.
  const sortedOrders = [...orders].sort((a, b) => b.createAt - a.createAt)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>

      {sortedOrders.map((order) => {
        const isCart = order.status === 'created'

        return (
          <div key={order.orderId} className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
              Order #{order.orderId} - {isCart ? 'Cart' : order.status}
            </h2>

            {isCart ? (
              <>
                {order.products.map((item, index) => (
                  <OrderListItem
                    key={item.product.id}
                    product={item.product}
                    amount={item.amount}
                    price={item.price}
                    orderId={order.orderId}
                    onAmountChange={handleAmountChange}
                    onDelete={handleDelete}
                    status="created"
                    isLast={index === order.products.length - 1}
                  />
                ))}
                <OrderSum orderId={order.orderId} products={order.products} />
              </>
            ) : (
              <OrderHistoryItem
                order={{
                  orderId: order.orderId,
                  status: order.status as OrderHistoryOrder['status'],
                  products: order.products,
                  deliveryAddress: order.deliveryAddress,
                  deliveryMethod: order.deliveryMethod,
                  payment: order.payment,
                  total: order.total
                }}
                onCancel={handleCancel}
                cancelling={cancellingOrderId === order.orderId}
                cancelError={cancelErrors[order.orderId]}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default OrderList
