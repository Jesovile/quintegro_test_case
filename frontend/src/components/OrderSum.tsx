import React from 'react'
import { Button } from '@/components/ui/button'

interface Product {
  id: string
  title: string
  description: string
  image: string
}

interface OrderItem {
  product: Product
  amount: number
  price: number
}

interface OrderSumProps {
  orderId: string
  products: OrderItem[]
  onProceedToCheckout: (orderId: string) => void
}

const OrderSum: React.FC<OrderSumProps> = ({ orderId, products, onProceedToCheckout }) => {
  const subtotal = products.reduce((total, item) => total + item.price * item.amount, 0)
  return <div className="mt-6 flex items-center justify-between rounded-lg bg-blue-600 p-6 text-white shadow-md">
    <h3 className="text-xl font-bold">Items: ${subtotal.toFixed(2)}</h3>
    <Button onClick={() => onProceedToCheckout(orderId)} className="bg-white text-blue-700 hover:bg-slate-100">Proceed to checkout</Button>
  </div>
}

export default OrderSum
