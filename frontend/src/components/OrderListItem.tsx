import React, { useEffect, useState } from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { useMutation } from '@apollo/client'
import { DELETE_PRODUCT_FROM_ORDER, UPDATE_PRODUCT_AMOUNT } from '../graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { formatUsd } from '@/lib/money'
import { OrderItem } from '@/types/order'

const MIN_AMOUNT = 1
const MAX_AMOUNT = 10

interface OrderListItemProps {
  item: OrderItem
  orderId: string
  editable: boolean
}

const OrderListItem: React.FC<OrderListItemProps> = ({ item, orderId, editable }) => {
  const { product, amount, price } = item
  const [draftAmount, setDraftAmount] = useState(String(amount))

  const [updateAmount, updateState] = useMutation(UPDATE_PRODUCT_AMOUNT, {
    onError: () => setDraftAmount(String(amount))
  })
  const [deleteProduct, deleteState] = useMutation(DELETE_PRODUCT_FROM_ORDER, {
    // Failures are shown from deleteState.error
    onError: () => undefined
  })

  const saving = updateState.loading || deleteState.loading
  const error = updateState.error ?? deleteState.error

  useEffect(() => {
    setDraftAmount(String(amount))
  }, [amount])

  const saveAmount = (newAmount: number) => {
    const clampedAmount = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, Math.trunc(newAmount) || MIN_AMOUNT))
    setDraftAmount(String(clampedAmount))

    if (clampedAmount !== amount) {
      updateAmount({ variables: { orderId, productId: product.id, amount: clampedAmount } })
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      saveAmount(Number(draftAmount))
    }
  }

  return (
    <div>
      <Card className="mb-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-blue-50 border-gray-200">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <Avatar className="w-20 h-20 rounded-lg transition-transform duration-300 hover:scale-105 border border-gray-200">
              <AvatarImage src={product.image} alt={product.title} />
              <AvatarFallback className="text-lg font-semibold bg-gray-100 text-gray-600">
                {product.title.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2 transition-colors duration-300 hover:text-blue-600 text-gray-900">
                {product.title}
              </h3>
              <p className="text-sm text-gray-600">
                {product.description}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3">
              <p className="text-lg font-bold text-blue-600">
                {formatUsd(price)}
              </p>
              {editable ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Decrease amount of ${product.title}`}
                    onClick={() => saveAmount(amount - 1)}
                    disabled={saving || amount <= MIN_AMOUNT}
                    className="h-9 w-9 transition-all duration-200 hover:bg-red-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    aria-label={`Amount of ${product.title}`}
                    value={draftAmount}
                    onChange={(event) => setDraftAmount(event.target.value)}
                    onBlur={() => saveAmount(Number(draftAmount))}
                    onKeyDown={handleKeyDown}
                    disabled={saving}
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    className="w-20 text-center h-9"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Increase amount of ${product.title}`}
                    onClick={() => saveAmount(amount + 1)}
                    disabled={saving || amount >= MAX_AMOUNT}
                    className="h-9 w-9 transition-all duration-200 hover:bg-green-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${product.title} from order`}
                    onClick={() => deleteProduct({ variables: { orderId, productId: product.id } })}
                    disabled={updateState.loading}
                    loading={deleteState.loading}
                    className="h-9 w-9 transition-all duration-200 text-red-600 hover:bg-red-500 hover:text-white hover:scale-110 border-gray-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Quantity: {amount}</p>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {getErrorMessage(error)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OrderListItem
