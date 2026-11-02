import React, { useState } from 'react'
import { useQuery } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import OrderCard from './OrderCard'
import PreviouslyOrdered from './PreviouslyOrdered'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { isCurrentOrder } from '@/lib/orderStatus'
import { nextTabIndex } from '@/lib/tabs'
import { Order } from '@/types/order'

type OrderTab = 'current' | 'history'

const tabId = (tab: OrderTab) => `order-tab-${tab}`
const panelId = (tab: OrderTab) => `order-tabpanel-${tab}`

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

  const tabs: { id: OrderTab; label: string; orders: Order[]; emptyText: string }[] = [
    { id: 'current', label: 'Current', orders: currentOrders, emptyText: 'You have no current orders.' },
    { id: 'history', label: 'History', orders: historyOrders, emptyText: 'You have no past orders yet.' }
  ]

  // Arrow keys move between tabs; only the selected tab is in the Tab order (roving tabindex)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(index, event.key, tabs.length)
    if (next === null) {
      return
    }
    event.preventDefault()
    setActiveTab(tabs[next].id)
    document.getElementById(tabId(tabs[next].id))?.focus()
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>

      <PreviouslyOrdered orders={historyOrders} />

      <div role="tablist" aria-label="Orders" className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={activeTab === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label} ({tab.orders.length})
          </button>
        ))}
      </div>

      {/* Both panels exist so every tab's aria-controls points at a real element; only the active one renders orders */}
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        const empty = tab.orders.length === 0
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelId(tab.id)}
            aria-labelledby={tabId(tab.id)}
            hidden={!active}
            // A panel without focusable content must still be reachable from the keyboard
            tabIndex={active && empty ? 0 : undefined}
          >
            {active &&
              (empty ? (
                <p className="text-center py-12 text-gray-600">{tab.emptyText}</p>
              ) : (
                tab.orders.map((order) => <OrderCard key={order.orderId} order={order} />)
              ))}
          </div>
        )
      })}
    </div>
  )
}

export default OrderList
