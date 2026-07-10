import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useHistory } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GET_CURRENT_CART } from '../graphql/queries'

// Rewritten per tech-design.md §6.4 / implementation-plan-05.md iteration
// 5.5 — drops the hardcoded browser-storage-backed `currentItems` stub
// (getItem/setItem, defaulted to 10, never reflected reality) entirely. Real
// cart state comes from the `currentCart` query (Feature 1), which only ever
// returns the user's single `created`-status order or null. After a
// successful payment (Feature 4) the order transitions to `paid`, so
// `currentCart` naturally returns null and the badge disappears — no
// explicit "clear cart" mutation exists or is needed (AC-502-1/502-2).
const CurrentOrder: React.FC = () => {
  const history = useHistory()
  const { data } = useQuery(GET_CURRENT_CART)

  const itemCount: number = data?.currentCart?.products?.reduce(
    (sum: number, item: { amount: number }) => sum + item.amount,
    0
  ) ?? 0

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
