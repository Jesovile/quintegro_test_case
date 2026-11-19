import React, { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import { GET_ORDERS } from '../graphql/queries'
import { DELETE_PRODUCT_FROM_ORDER, UPDATE_DELIVERY_INFO } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import { DeliveryInfoEditor, type DeliveryInfo } from './DeliveryInfoEditor'
import { Button } from './ui/button'
import { Loader2, Pencil } from 'lucide-react'

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
  deliveryInfo?: DeliveryInfo | null
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const history = useHistory()

  const { loading, error } = useQuery(GET_ORDERS, {
    onCompleted: (data) => {
      setOrders(data.orders || [])
    },
    onError: (error) => {
      console.error('GraphQL error:', error)
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

  const [updateDeliveryInfo] = useMutation(UPDATE_DELIVERY_INFO)

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

  const handleCheckout = (orderId: string) => history.push(`/checkout/${orderId}`)

  const handleDeliverySave = async (deliveryInfo: DeliveryInfo) => {
    if (!editingOrder) return
    const { data } = await updateDeliveryInfo({
      variables: { orderId: editingOrder.orderId, deliveryInfo },
    })
    setOrders(previous => previous.map(order => order.orderId === data.updateDeliveryInfo.orderId ? data.updateDeliveryInfo : order))
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
      
      {orders.map((order) => (
        (() => {
          const isAccepted = order.status === 'submited'
          const isFinalized = isAccepted || order.status === 'finished'
          const displayStatus = order.status === 'submited' ? 'Заказ принят' : order.status === 'finished' ? 'Завершён' : 'Ожидает оформления'

          return <div key={order.orderId} className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-200 pb-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Order #{order.orderId} - <span className={isFinalized ? 'text-green-600' : ''}>{displayStatus}</span>
            </h2>
            {isAccepted && <Button variant="ghost" size="icon" aria-label="Редактировать доставку" title="Редактировать доставку" onClick={() => setEditingOrder(order)}><Pencil className="h-4 w-4" /></Button>}
          </div>

          {isFinalized && <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">Доставка</p>
            {order.deliveryInfo ? <div className="mt-2 grid gap-1 sm:grid-cols-2"><p>{order.deliveryInfo.recipientName}</p><p>{order.deliveryInfo.phone}</p><p className="sm:col-span-2">{order.deliveryInfo.city}, {order.deliveryInfo.addressLine1}{order.deliveryInfo.postalCode ? `, ${order.deliveryInfo.postalCode}` : ''}</p></div> : <p className="mt-2 text-gray-500">Данные доставки не указаны.</p>}
          </div>}
          
          {order.products.map((item, index) => (
            <OrderListItem
              key={item.product.id}
              product={item.product}
              amount={item.amount}
              price={item.price}
              orderId={order.orderId}
              onAmountChange={handleAmountChange}
              onDelete={handleDelete}
              onCheckout={handleCheckout}
              status={order.status}
              isLast={index === order.products.length -1}
              isEditable={!isFinalized}
            />
          ))}
          <OrderSum orderId={order.orderId} products={order.products} />
        </div>
        }
        )()
      ))}
      {editingOrder && <DeliveryInfoEditor initialValue={editingOrder.deliveryInfo} onClose={() => setEditingOrder(null)} onSave={handleDeliverySave} />}
    </div>
  )
}

export default OrderList
