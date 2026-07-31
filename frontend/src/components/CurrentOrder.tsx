import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GET_ORDERS } from '../graphql/queries'
import { Order } from '../lib/checkoutTypes'

const CurrentOrder: React.FC = () => {
  const history = useHistory()
  const { data } = useQuery<{ orders: Order[] }>(GET_ORDERS)
  const itemCount = (data?.orders || []).filter(order => order.status === 'created').reduce((total, order) => total + order.products.reduce((sum, item) => sum + item.amount, 0), 0)

  const handleClick = () => {
    history.push('/order')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="text-gray-700 hover:bg-gray-100 relative"
      title="Current Order"
    >
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs bg-blue-500 text-white">
          {itemCount}
        </Badge>
      )}
    </Button>
  )
}

export default CurrentOrder
