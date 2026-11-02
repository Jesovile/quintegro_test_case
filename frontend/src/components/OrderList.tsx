import React, { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import CheckoutAction from './CheckoutAction'
import PreviouslyOrdered from './PreviouslyOrdered'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { ORDER_STATUS_LABELS, isCurrentOrder, isEditableOrder } from '@/lib/orderStatus'

type OrderTab = 'current' | 'history'

const OrderList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OrderTab>('current')

  const { loading, error, data, refetch } = useQuery(GET_ORDERS)

  if (loading && !data) {
    return <LoadingState label="Loading orders..." />
  }

  if (error && !data) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
  }

  const orders = data?.orders ?? []

  if (orders.length === 0) {
    return <EmptyState title="No orders found" description="You don't have any orders yet." />
  }

  const currentOrders = orders.filter(order => isCurrentOrder(order.status))
  const historyOrders = orders.filter(order => !isCurrentOrder(order.status))
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

      <PreviouslyOrdered orders={historyOrders} />

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
                Order #{order.orderId} - {ORDER_STATUS_LABELS[order.status]}
              </h2>

              {order.products.map((item) => (
                <OrderListItem
                  key={item.product.id}
                  item={item}
                  orderId={order.orderId}
                  editable={isEditableOrder(order.status)}
                />
              ))}
              {order.products.length === 0 && (
                <p className="text-center py-6 text-gray-600">This order is empty.</p>
              )}
              <OrderSum order={order} />
              <CheckoutAction order={order} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default OrderList
