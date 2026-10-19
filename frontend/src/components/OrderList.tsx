import React, { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import { SUBMIT_ORDER, DELETE_PRODUCT_FROM_ORDER } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
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

interface Order {
  orderId: string
  status: 'created' | 'submited' | 'finished'
  products: OrderItem[]
}

type OrderTab = 'current' | 'history'

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<OrderTab>('current')

  const { loading, error, refetch } = useQuery(GET_ORDERS, {
    onCompleted: (data) => {
      setOrders(data.orders || [])
    },
    onError: (error) => {
      console.error('GraphQL error:', error)
    }
  })

  const [submitOrder] = useMutation(SUBMIT_ORDER, {
    onCompleted: () => {
      refetch()
    },
    onError: (error) => {
      console.error('Failed to submit order:', error)
    }
  })

  const [_deleteProduct] = useMutation(DELETE_PRODUCT_FROM_ORDER, {
    onCompleted: (data) => {
      // Update local state with the returned order
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.orderId === data.deleteProductFromOrder.orderId 
            ? data.deleteProductFromOrder 
            : order
        )
      )
    },
    onError: (error) => {
      console.error('Failed to delete product:', error)
    }
  })

  const handleAmountChange = (productId: string, newAmount: number) => {
    setOrders(prevOrders => 
      prevOrders.map(order => ({
        ...order,
        products: order.products.map(item => 
          item.product.id === productId 
            ? { ...item, amount: newAmount }
            : item
        )
      }))
    )
  }

  const handleDelete = (productId: string) => {
    setOrders(prevOrders => 
      prevOrders.map(order => ({
        ...order,
        products: order.products.filter(item => item.product.id !== productId)
      })).filter(order => order.products.length > 0)
    )
  }

  const handleSubmitOrder = async (orderId: string) => {
    try {
      await submitOrder({
        variables: { orderId }
      })
    } catch (error) {
      console.error('Error submitting order:', error)
    }
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

  const currentOrders = orders.filter(order => order.status === 'created')
  const historyOrders = orders.filter(order => order.status !== 'created')
  const visibleOrders = activeTab === 'current' ? currentOrders : historyOrders

  const tabs: { id: OrderTab; label: string; count: number }[] = [
    { id: 'current', label: 'Current', count: currentOrders.length },
    { id: 'history', label: 'History', count: historyOrders.length }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>

      <div role="tablist" className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`order-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`order-tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`order-tabpanel-${activeTab}`}
        aria-labelledby={`order-tab-${activeTab}`}
      >
        {visibleOrders.length === 0 ? (
          <p className="text-center py-12 text-gray-600">
            {activeTab === 'current' ? 'You have no current orders.' : 'You have no past orders yet.'}
          </p>
        ) : (
          visibleOrders.map((order) => (
            <div key={order.orderId} className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
                Order #{order.orderId} - {order.status}
              </h2>

              {order.products.map((item, index) => (
                <OrderListItem
                  key={item.product.id}
                  product={item.product}
                  amount={item.amount}
                  price={item.price}
                  orderId={order.orderId}
                  onAmountChange={handleAmountChange}
                  onDelete={handleDelete}
                  onSubmitOrder={handleSubmitOrder}
                  status={order.status}
                  isLast={index === order.products.length -1}
                />
              ))}
              <OrderSum orderId={order.orderId} products={order.products} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default OrderList
