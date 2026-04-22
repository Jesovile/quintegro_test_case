import React from 'react'
import OrderTabs from '../components/OrderTabs'
import OrderList from '../components/OrderList'

const OrderHistoryPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Your Orders</h1>
      <OrderTabs />
      <OrderList mode="history" />
    </div>
  )
}

export default OrderHistoryPage
