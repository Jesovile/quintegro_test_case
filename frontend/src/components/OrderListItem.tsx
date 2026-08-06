import React, { useEffect, useState } from 'react'
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react'
import { useMutation } from '@apollo/client'
import { DELETE_PRODUCT_FROM_ORDER } from '../graphql/mutations'
import { Button } from '@/components/ui/button'

interface OrderListItemProps {
  product: {
    id: string
    title: string
    description: string
    image: string
  }
  amount: number
  price: number
  orderId: string
  editable: boolean
  canDelete: boolean
  onAmountChange: (productId: string, newAmount: number) => void
  onDelete: (productId: string) => void
  onError: (message: string) => void
}

const OrderListItem: React.FC<OrderListItemProps> = ({
  product,
  amount,
  price,
  orderId,
  editable,
  canDelete,
  onAmountChange,
  onDelete,
  onError
}) => {
  const [currentAmount, setCurrentAmount] = useState(amount)

  useEffect(() => {
    setCurrentAmount(amount)
  }, [amount])

  const [deleteProduct, { loading: isDeleting }] = useMutation(DELETE_PRODUCT_FROM_ORDER, {
    onCompleted: () => onDelete(product.id),
    onError: (error) => onError(error.message || 'Could not remove this item.')
  })

  const changeAmount = (nextAmount: number) => {
    const clampedAmount = Math.max(1, Math.min(10, nextAmount))
    setCurrentAmount(clampedAmount)
    onAmountChange(product.id, clampedAmount)
  }

  const handleDelete = async () => {
    try {
      await deleteProduct({ variables: { orderId, productId: product.id } })
    } catch {
      // Apollo's onError surfaces the actionable message in the order card.
    }
  }

  return (
    <div className="grid gap-4 border-b border-slate-100 py-5 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          <span className="text-lg font-semibold text-slate-400" aria-hidden="true">
            {product.title.charAt(0)}
          </span>
          <img
            src={product.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{product.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{product.description}</p>
          <p className="mt-2 text-sm font-medium text-slate-700">${price.toFixed(2)} each</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {editable ? (
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1" aria-label={`Quantity for ${product.title}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeAmount(currentAmount - 1)}
              disabled={currentAmount <= 1}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-9 text-center text-sm font-semibold tabular-nums text-slate-900">
              {currentAmount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeAmount(currentAmount + 1)}
              disabled={currentAmount >= 10}
              className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
            Qty {currentAmount}
          </span>
        )}

        <p className="w-24 text-right font-semibold tabular-nums text-slate-900">
          ${(price * currentAmount).toFixed(2)}
        </p>

        {editable && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting || !canDelete}
            className="h-9 w-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label={`Remove ${product.title}`}
            title={canDelete ? `Remove ${product.title}` : 'An order must contain at least one item'}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

export default OrderListItem
