import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Order, isCurrent } from '../types/order'

const CurrentOrder: React.FC = () => {
  const history = useHistory()
  const isAuthenticated = !!localStorage.getItem('auth_token')

  const { data } = useQuery<{ orders: Order[] }>(GET_ORDERS, {
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network',
    onError: () => {}
  })

  const itemCount = (data?.orders ?? [])
    .filter(isCurrent)
    .reduce((sum, o) => sum + o.products.reduce((s, p) => s + p.amount, 0), 0)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => history.push('/order/current')}
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
