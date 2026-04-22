import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const linkBase =
  'px-4 py-2 rounded-md text-sm font-medium transition-colors border border-transparent'
const linkIdle = 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
const linkActive = 'bg-white text-blue-700 border-gray-200 shadow-sm'

const OrderTabs: React.FC = () => {
  return (
    <nav className="inline-flex gap-1 p-1 bg-gray-100 rounded-lg mb-6">
      <NavLink
        to="/order/current"
        className={cn(linkBase, linkIdle)}
        activeClassName={linkActive}
      >
        Current
      </NavLink>
      <NavLink
        to="/order/history"
        className={cn(linkBase, linkIdle)}
        activeClassName={linkActive}
      >
        History
      </NavLink>
    </nav>
  )
}

export default OrderTabs
