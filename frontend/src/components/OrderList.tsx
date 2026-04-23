import React, { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { GET_ORDERS } from '../graphql/queries'
import { SUBMIT_ORDER, DELETE_PRODUCT_FROM_ORDER, PROCESS_PAYMENT } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
import OrderSum from './OrderSum'
import { Loader2 } from 'lucide-react'

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

interface Order {
  orderId: string
  status: 'created' | 'submited' | 'finished'
  products: OrderItem[]
  deliveryType?: DeliveryType
  shippingAddress?: string
  paymentMethod?: PaymentMethod
  deliveryCost?: number
}

type DeliveryType = 'standard' | 'express'
type PaymentMethod = 'card' | 'paypal'

interface CheckoutState {
  deliveryType: DeliveryType
  shippingAddress: string
  paymentMethod: PaymentMethod
  deliveryCost: number
}

interface CardPaymentState {
  cardNumber: string
  cardHolder: string
  expiryDate: string
  cvv: string
}

const DELIVERY_COST_USD: Record<DeliveryType, number> = {
  standard: 5,
  express: 15
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [checkoutByOrder, setCheckoutByOrder] = useState<Record<string, CheckoutState>>({})
  const [validationByOrder, setValidationByOrder] = useState<Record<string, string>>({})
  const [showCardFormByOrder, setShowCardFormByOrder] = useState<Record<string, boolean>>({})
  const [cardFormByOrder, setCardFormByOrder] = useState<Record<string, CardPaymentState>>({})
  const [cardSubmitByOrder, setCardSubmitByOrder] = useState<Record<string, string>>({})

  const { loading, error, refetch } = useQuery(GET_ORDERS, {
    onCompleted: (data) => {
      const receivedOrders: Order[] = data.orders || []
      setOrders(receivedOrders)
      setCheckoutByOrder((prev) => {
        const next = { ...prev }
        receivedOrders.forEach((order) => {
          if (!next[order.orderId]) {
            next[order.orderId] = {
              deliveryType: order.deliveryType || 'standard',
              shippingAddress: order.shippingAddress || '',
              paymentMethod: order.paymentMethod || 'card',
              deliveryCost: order.deliveryCost ?? DELIVERY_COST_USD[order.deliveryType || 'standard']
            }
          }
        })
        return next
      })
    },
    onError: (error) => {
      console.error('GraphQL error:', error)
    }
  })

  const [submitOrder] = useMutation(SUBMIT_ORDER, {
    onError: (error) => {
      console.error('Failed to submit order:', error)
    }
  })
  const [processPayment] = useMutation(PROCESS_PAYMENT, {
    onError: (error) => {
      console.error('Failed to process payment:', error)
    }
  })

  const [_deleteProduct] = useMutation(DELETE_PRODUCT_FROM_ORDER, {
    onCompleted: (data) => {
      // Update local state with the returned order
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.orderId === data.deleteProductFromOrder.orderId 
            ? data.deleteProductFromOrder 
            : order
        )
      )
    },
    onError: (error) => {
      console.error('Failed to delete product:', error)
    }
  })

  const handleAmountChange = (orderId: string, productId: string, newAmount: number) => {
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order.orderId !== orderId || order.status !== 'created') {
          return order
        }
        return {
          ...order,
          products: order.products.map(item => 
            item.product.id === productId 
              ? { ...item, amount: newAmount }
              : item
          )
        }
      })
    )
  }

  const handleDelete = (orderId: string, productId: string) => {
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order.orderId !== orderId || order.status !== 'created') {
          return order
        }
        return {
          ...order,
          products: order.products.filter(item => item.product.id !== productId)
        }
      }).filter(order => order.products.length > 0)
    )
  }

  const handleSubmitOrder = async (orderId: string) => {
    const checkout = checkoutByOrder[orderId]
    if (!checkout) {
      setValidationByOrder((prev) => ({ ...prev, [orderId]: 'Checkout data is missing' }))
      return
    }

    if (!checkout.shippingAddress.trim()) {
      setValidationByOrder((prev) => ({ ...prev, [orderId]: 'Shipping address is required' }))
      return
    }

    if (!checkout.paymentMethod) {
      setValidationByOrder((prev) => ({ ...prev, [orderId]: 'Payment method is required' }))
      return
    }

    setValidationByOrder((prev) => ({ ...prev, [orderId]: '' }))

    try {
      const result = await submitOrder({
        variables: {
          orderId,
          deliveryType: checkout.deliveryType,
          shippingAddress: checkout.shippingAddress.trim(),
          paymentMethod: checkout.paymentMethod,
          currency: 'USD',
          deliveryCost: checkout.deliveryCost
        }
      })
      if (result.data?.submitOrder) {
        if (checkout.paymentMethod === 'card') {
          setShowCardFormByOrder((prev) => ({
            ...prev,
            [orderId]: true
          }))
          setCardSubmitByOrder((prev) => ({ ...prev, [orderId]: 'Enter card details to complete payment' }))
        } else {
          const paymentResult = await processPayment({
            variables: { orderId, input: null }
          })
          if (paymentResult.data?.processPayment) {
            setShowCardFormByOrder((prev) => ({ ...prev, [orderId]: false }))
            setCardSubmitByOrder((prev) => ({ ...prev, [orderId]: 'PayPal payment successful (mock)' }))
            await refetch()
          }
        }
      }
    } catch (error) {
      console.error('Error submitting order:', error)
    }
  }

  const handleCheckoutChange = <K extends keyof CheckoutState>(orderId: string, key: K, value: CheckoutState[K]) => {
    setCheckoutByOrder((prev) => {
      const current = prev[orderId] || {
        deliveryType: 'standard',
        shippingAddress: '',
        paymentMethod: 'card',
        deliveryCost: DELIVERY_COST_USD.standard
      }
      const updated: CheckoutState = { ...current, [key]: value }
      if (key === 'deliveryType') {
        const selectedType = value as DeliveryType
        updated.deliveryCost = DELIVERY_COST_USD[selectedType]
      }
      return { ...prev, [orderId]: updated }
    })
  }

  const handleCardFieldChange = (orderId: string, field: keyof CardPaymentState, value: string) => {
    setCardFormByOrder((prev) => ({
      ...prev,
      [orderId]: {
        cardNumber: prev[orderId]?.cardNumber || '',
        cardHolder: prev[orderId]?.cardHolder || '',
        expiryDate: prev[orderId]?.expiryDate || '',
        cvv: prev[orderId]?.cvv || '',
        [field]: value
      }
    }))
  }

  const handleCardPay = async (orderId: string) => {
    const form = cardFormByOrder[orderId]
    if (!form?.cardNumber || !form?.cardHolder || !form?.expiryDate || !form?.cvv) {
      setCardSubmitByOrder((prev) => ({ ...prev, [orderId]: 'Fill all card fields to continue' }))
      return
    }
    try {
      const result = await processPayment({
        variables: {
          orderId,
          input: {
            cardNumber: form.cardNumber,
            cardHolder: form.cardHolder,
            expiryDate: form.expiryDate,
            cvv: form.cvv
          }
        }
      })

      if (result.data?.processPayment) {
        setCardSubmitByOrder((prev) => ({ ...prev, [orderId]: 'Payment authorized (mock)' }))
        setShowCardFormByOrder((prev) => ({ ...prev, [orderId]: false }))
        await refetch()
      }
    } catch (error) {
      console.error('Payment error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">
              {error.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            No orders found
          </h2>
          <p className="mt-2 text-gray-600">
            You don't have any orders yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        Your Orders
      </h1>
      
      {orders.map((order) => (
        <div key={order.orderId} className="mb-8 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 border-b border-gray-200 pb-3">
            Order #{order.orderId} - {order.status}
          </h2>

          <div className="mb-6 rounded-md border border-gray-200 p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Checkout details</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Delivery type</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                  value={checkoutByOrder[order.orderId]?.deliveryType || 'standard'}
                  disabled={order.status !== 'created'}
                  onChange={(event) => handleCheckoutChange(order.orderId, 'deliveryType', event.target.value as DeliveryType)}
                >
                  <option value="standard">Standard - $5.00</option>
                  <option value="express">Express - $15.00</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Payment method</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                  value={checkoutByOrder[order.orderId]?.paymentMethod || 'card'}
                  disabled={order.status !== 'created'}
                  onChange={(event) => handleCheckoutChange(order.orderId, 'paymentMethod', event.target.value as PaymentMethod)}
                >
                  <option value="card">Bank card</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium text-gray-700">Shipping address</label>
              <input
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                type="text"
                placeholder="Enter delivery address"
                value={checkoutByOrder[order.orderId]?.shippingAddress || ''}
                disabled={order.status !== 'created'}
                onChange={(event) => handleCheckoutChange(order.orderId, 'shippingAddress', event.target.value)}
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Currency: USD. Delivery cost is mocked on client and verified by backend.
            </p>
            {validationByOrder[order.orderId] && (
              <p className="mt-2 text-sm text-red-600">{validationByOrder[order.orderId]}</p>
            )}
          </div>
          
          {order.products.map((item, index) => (
            <OrderListItem
              key={item.product.id}
              product={item.product}
              amount={item.amount}
              price={item.price}
              orderId={order.orderId}
              onAmountChange={handleAmountChange}
              onDelete={handleDelete}
              onSubmitOrder={handleSubmitOrder}
              status={order.status}
              isLast={index === order.products.length -1}
            />
          ))}
          <OrderSum
            orderId={order.orderId}
            products={order.products}
            deliveryCost={checkoutByOrder[order.orderId]?.deliveryCost || DELIVERY_COST_USD.standard}
          />
          {showCardFormByOrder[order.orderId] && (
            <div className="mt-4 rounded-md border border-blue-200 p-4 bg-blue-50">
              <h4 className="font-semibold text-gray-900 mb-2">Card payment details (mock)</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-md border border-gray-300 p-2 text-sm"
                  type="text"
                  placeholder="Card number"
                  value={cardFormByOrder[order.orderId]?.cardNumber || ''}
                  onChange={(event) => handleCardFieldChange(order.orderId, 'cardNumber', event.target.value)}
                />
                <input
                  className="rounded-md border border-gray-300 p-2 text-sm"
                  type="text"
                  placeholder="Card holder"
                  value={cardFormByOrder[order.orderId]?.cardHolder || ''}
                  onChange={(event) => handleCardFieldChange(order.orderId, 'cardHolder', event.target.value)}
                />
                <input
                  className="rounded-md border border-gray-300 p-2 text-sm"
                  type="text"
                  placeholder="MM/YY"
                  value={cardFormByOrder[order.orderId]?.expiryDate || ''}
                  onChange={(event) => handleCardFieldChange(order.orderId, 'expiryDate', event.target.value)}
                />
                <input
                  className="rounded-md border border-gray-300 p-2 text-sm"
                  type="password"
                  placeholder="CVV"
                  value={cardFormByOrder[order.orderId]?.cvv || ''}
                  onChange={(event) => handleCardFieldChange(order.orderId, 'cvv', event.target.value)}
                />
              </div>
              <button
                className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => handleCardPay(order.orderId)}
                type="button"
              >
                Pay by card
              </button>
              {cardSubmitByOrder[order.orderId] && (
                <p className="mt-2 text-sm text-gray-700">{cardSubmitByOrder[order.orderId]}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default OrderList
