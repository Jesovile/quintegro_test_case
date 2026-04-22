import React from 'react'
import OrderTabs from '../components/OrderTabs'
import OrderList from '../components/OrderList'

const CurrentOrdersPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Your Orders</h1>
      <OrderTabs />
      <OrderList mode="current" />
    </div>
  )
}

export default CurrentOrdersPage
