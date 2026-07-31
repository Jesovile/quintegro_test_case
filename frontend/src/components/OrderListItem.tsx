import React from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface OrderListItemProps {
  product: {
    id: string
    title: string
    description: string
    image: string
  }
  amount: number
  price: number
  onAmountChange: (productId: string, newAmount: number) => void
  onDelete: (productId: string) => void
  editable: boolean;
}

const OrderListItem: React.FC<OrderListItemProps> = ({ product, amount, price, onAmountChange, onDelete, editable }) => {

  const handleAmountChange = (newAmount: number) => {
    const clampedAmount = Math.max(1, Math.min(10, newAmount))
    onAmountChange(product.id, clampedAmount)
  }

  const handleIncrement = () => {
    handleAmountChange(amount + 1)
  }

  const handleDecrement = () => {
    handleAmountChange(amount - 1)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    handleAmountChange(value)
  }

  const handleDelete = () => onDelete(product.id)

  return (
    <div>
      <Card className="mb-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-blue-50 border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
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
            <div className="flex flex-col items-end gap-3">
              <p className="text-lg font-bold text-blue-600">
                ${price.toFixed(2)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDecrement}
                  disabled={!editable || amount <= 1}
                  className="h-9 w-9 transition-all duration-200 hover:bg-red-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={amount}
                  onChange={handleInputChange}
                  min={1}
                  max={10}
                  className="w-20 text-center h-9"
                  disabled={!editable}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleIncrement}
                  disabled={!editable || amount >= 10}
                  className="h-9 w-9 transition-all duration-200 hover:bg-green-500 hover:text-white hover:scale-110 disabled:opacity-50 border-gray-300"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDelete}
                  disabled={!editable}
                  className="h-9 w-9 transition-all duration-200 text-red-600 hover:bg-red-500 hover:text-white hover:scale-110 border-gray-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OrderListItem
