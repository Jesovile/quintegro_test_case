import React from 'react'
import { History } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface Product {
  id: string
  title: string
  image: string
}

interface OrderItem {
  product: Product
}

interface Order {
  orderId: string
  products: OrderItem[]
}

interface PreviouslyOrderedProps {
  orders: Order[]
}

const linkClassName = 'text-blue-600 hover:text-blue-800 hover:underline underline-offset-2 cursor-pointer transition-colors'

const PreviouslyOrdered: React.FC<PreviouslyOrderedProps> = ({ orders }) => {
  const items = orders.flatMap(order =>
    order.products.map(item => ({ orderId: order.orderId, product: item.product }))
  )

  if (items.length === 0) {
    return null
  }

  return (
    <section className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <History className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          You've ordered before
        </h2>
        <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {items.length}
        </span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(({ orderId, product }) => (
          <li
            key={`${orderId}-${product.id}`}
            className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
          >
            <Avatar className="h-10 w-10 rounded-md border border-gray-200 bg-white">
              <AvatarImage src={product.image} alt={product.title} />
              <AvatarFallback className="rounded-md text-sm font-semibold bg-gray-100 text-gray-600">
                {product.title.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-sm">
              <span className={`block truncate font-medium ${linkClassName}`}>{product.title}</span>
              <span className="text-gray-500">in </span>
              {/* Points to the order in the History tab; navigation is intentionally disabled */}
              <a
                href={`#${orderId}`}
                onClick={(event) => event.preventDefault()}
                className={linkClassName}
              >
                Order #{orderId}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default PreviouslyOrdered
