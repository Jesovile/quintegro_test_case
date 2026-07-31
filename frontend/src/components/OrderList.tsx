import React from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import { GET_ORDERS } from '../graphql/queries'
import { DELETE_PRODUCT_FROM_ORDER, UPDATE_PRODUCT_AMOUNT } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import { Loader2 } from 'lucide-react'

import { Order } from '../lib/checkoutTypes'

const OrderList: React.FC = () => {
  const history = useHistory()
  const { loading, error, data, refetch } = useQuery<{ orders: Order[] }>(GET_ORDERS)
  const orders = data?.orders || []

  const [_deleteProduct] = useMutation(DELETE_PRODUCT_FROM_ORDER, {
    onCompleted: () => void refetch()
  })

  const [updateProductAmount] = useMutation(UPDATE_PRODUCT_AMOUNT, { onCompleted: () => void refetch() })

  const handleAmountChange = (orderId: string, productId: string, amount: number) => {
    void updateProductAmount({ variables: { orderId, productId, amount } })
  }

  const handleDelete = (orderId: string, productId: string) => {
    void _deleteProduct({ variables: { orderId, productId } })
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>
      
      {orders.filter(order => order.status === 'created').map((order) => (
        <div key={order.orderId} className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
            Order #{order.orderId} - {order.status}
          </h2>
          
          {order.products.map((item) => (
            <OrderListItem
              key={item.product.id}
              product={item.product}
              amount={item.amount}
              price={item.price}
              onAmountChange={(productId, amount) => handleAmountChange(order.orderId, productId, amount)}
              onDelete={productId => handleDelete(order.orderId, productId)}
              editable
            />
          ))}
          <OrderSum orderId={order.orderId} products={order.products} onProceedToCheckout={id => history.push(`/checkout/${id}`)} />
        </div>
      ))}
      {orders.filter(order => order.status !== 'created').length > 0 && <>
        <h2 className="mt-12 text-2xl font-bold text-gray-900">Order history</h2>
        {orders.filter(order => order.status !== 'created').map(order => <div key={order.orderId} className="mt-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Order #{order.orderId} — {order.status}</h3>
          {order.products.map(item => <OrderListItem key={item.product.id} product={item.product} amount={item.amount} price={item.price} onAmountChange={() => undefined} onDelete={() => undefined} editable={false} />)}
          {order.checkout && <button type="button" onClick={() => history.push(`/checkout/${order.orderId}`)} className="mt-3 text-blue-700">Open confirmation</button>}
        </div>)}
      </>}
    </div>
  )
}

export default OrderList
