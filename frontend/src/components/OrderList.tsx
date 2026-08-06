import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag
} from 'lucide-react'
import { GET_ORDERS } from '../graphql/queries'
import { SUBMIT_ORDER } from '../graphql/mutations'
import OrderListItem from './OrderListItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

type OrderStatus = 'created' | 'submited' | 'waiting_payment' | 'finished'

interface Order {
  orderId: string
  status: OrderStatus
  products: OrderItem[]
}

type Filter = 'all' | 'action' | 'completed'

const statusConfig: Record<OrderStatus, { label: string; badge: string; description: string }> = {
  created: {
    label: 'Draft',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    description: 'Review your items before starting checkout.'
  },
  submited: {
    label: 'Checkout ready',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    description: 'Add delivery and payment details to finish this order.'
  },
  waiting_payment: {
    label: 'Payment required',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    description: 'Your order is reserved and ready for secure payment.'
  },
  finished: {
    label: 'Completed',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    description: 'Payment confirmed. This order is complete.'
  }
}

const getProgressStep = (status: OrderStatus) => {
  if (status === 'finished') return 3
  if (status === 'submited' || status === 'waiting_payment') return 2
  return 1
}

const OrderProgress: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const activeStep = getProgressStep(status)
  const steps = [
    { label: 'Review', icon: ClipboardCheck },
    { label: 'Checkout', icon: CreditCard },
    { label: 'Complete', icon: CheckCircle2 }
  ]

  return (
    <div className="flex items-center" aria-label={`Order progress: step ${activeStep} of 3`}>
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const complete = stepNumber < activeStep || activeStep === 3
        const active = stepNumber === activeStep
        const Icon = step.icon

        return (
          <React.Fragment key={step.label}>
            {index > 0 && (
              <div className={cn('mx-2 h-px min-w-3 flex-1 sm:mx-3', stepNumber <= activeStep ? 'bg-emerald-400' : 'bg-slate-200')} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors',
                complete && 'border-emerald-500 bg-emerald-500 text-white',
                active && activeStep !== 3 && 'border-blue-600 bg-blue-600 text-white',
                !complete && !active && 'border-slate-200 bg-white text-slate-400'
              )}>
                {complete ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className={cn('text-[11px] font-medium', active || complete ? 'text-slate-700' : 'text-slate-400')}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

const OrderList: React.FC = () => {
  const history = useHistory()
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null)
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({})

  const { loading, error, refetch } = useQuery(GET_ORDERS, {
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => setOrders(data.orders || []),
    onError: (queryError) => console.error('GraphQL error:', queryError)
  })

  const [submitOrder] = useMutation(SUBMIT_ORDER)

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (filter === 'completed') return order.status === 'finished'
    if (filter === 'action') return order.status !== 'finished'
    return true
  }), [filter, orders])

  const actionCount = orders.filter((order) => order.status !== 'finished').length
  const completedCount = orders.filter((order) => order.status === 'finished').length

  const setOrderError = (orderId: string, message: string) => {
    setOrderErrors((current) => ({ ...current, [orderId]: message }))
  }

  const clearOrderError = (orderId: string) => {
    setOrderErrors((current) => {
      const next = { ...current }
      delete next[orderId]
      return next
    })
  }

  const handleAmountChange = (orderId: string, productId: string, newAmount: number) => {
    setOrders((current) => current.map((order) => order.orderId === orderId
      ? { ...order, products: order.products.map((item) => item.product.id === productId ? { ...item, amount: newAmount } : item) }
      : order
    ))
  }

  const handleDelete = (orderId: string, productId: string) => {
    clearOrderError(orderId)
    setOrders((current) => current.map((order) => order.orderId === orderId
      ? { ...order, products: order.products.filter((item) => item.product.id !== productId) }
      : order
    ))
  }

  const handleSubmitOrder = async (orderId: string) => {
    setSubmittingOrderId(orderId)
    clearOrderError(orderId)

    try {
      const result = await submitOrder({ variables: { orderId } })
      if (result.data?.submitOrder !== true) throw new Error('The order could not be submitted.')

      setOrders((current) => current.map((order) => order.orderId === orderId
        ? { ...order, status: 'waiting_payment' }
        : order
      ))
      history.push(`/order/${orderId}/checkout`)
    } catch (submitError) {
      setOrderError(orderId, submitError instanceof Error ? submitError.message : 'Failed to start checkout. Please try again.')
    } finally {
      setSubmittingOrderId(null)
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6" aria-live="polite">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />)}
        </div>
        <span className="sr-only">Loading orders...</span>
      </div>
    )
  }

  if (error && orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-red-100 bg-white px-6 py-14 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle className="h-6 w-6" /></div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">We couldn't load your orders</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">The service may be temporarily unavailable. Your order data is safe.</p>
        <Button onClick={() => void refetch()} className="mt-6 rounded-xl bg-slate-900 hover:bg-slate-800">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShoppingBag className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-900">No orders yet</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">When you place an order, you'll be able to review its items and continue checkout here.</p>
        <Button onClick={() => history.push('/')} className="mt-6 rounded-xl">Continue shopping</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Your account</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Orders</h1>
          <p className="mt-2 max-w-xl text-slate-500">Review active orders, continue checkout, or revisit completed purchases.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Package className="h-4 w-4" />
          <span>{orders.length} {orders.length === 1 ? 'order' : 'orders'} total</span>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Filter orders">
        {([
          ['all', 'All orders', orders.length],
          ['action', 'Needs action', actionCount],
          ['completed', 'Completed', completedCount]
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              filter === value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {label}
            <span className={cn('rounded-full px-2 py-0.5 text-xs', filter === value ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500')}>{count}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Showing saved results. Refresh to get the latest order status.</span>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} className="text-amber-900 hover:bg-amber-100">Refresh</Button>
        </div>
      )}

      <div className="space-y-6">
        {visibleOrders.map((order) => {
          const itemCount = order.products.reduce((sum, item) => sum + item.amount, 0)
          const total = order.products.reduce((sum, item) => sum + item.amount * item.price, 0)
          const editable = order.status === 'created'
          const isSubmitting = submittingOrderId === order.orderId
          const config = statusConfig[order.status]

          return (
            <article key={order.orderId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
              <header className="grid gap-6 border-b border-slate-100 bg-slate-50/70 p-5 sm:p-6 lg:grid-cols-[1fr_300px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">Order #{order.orderId}</h2>
                    <Badge variant="outline" className={cn('px-2.5 py-1 font-medium', config.badge)}>{config.label}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{config.description}</p>
                </div>
                <OrderProgress status={order.status} />
              </header>

              <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="px-5 sm:px-6">
                  {order.products.map((item) => (
                    <OrderListItem
                      key={item.product.id}
                      product={item.product}
                      amount={item.amount}
                      price={item.price}
                      orderId={order.orderId}
                      editable={editable}
                      canDelete={order.products.length > 1}
                      onAmountChange={(productId, amount) => handleAmountChange(order.orderId, productId, amount)}
                      onDelete={(productId) => handleDelete(order.orderId, productId)}
                      onError={(message) => setOrderError(order.orderId, message)}
                    />
                  ))}
                </div>

                <aside className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Order summary</p>
                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex justify-between text-slate-500"><span>Items</span><span>{itemCount}</span></div>
                    <div className="flex justify-between text-slate-500"><span>Delivery</span><span>Calculated at checkout</span></div>
                  </div>
                  <div className="my-5 h-px bg-slate-200" />
                  <div className="flex items-end justify-between">
                    <span className="font-medium text-slate-700">Subtotal</span>
                    <span className="text-2xl font-bold tracking-tight text-slate-950">${total.toFixed(2)}</span>
                  </div>

                  {orderErrors[order.orderId] && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      {orderErrors[order.orderId]}
                    </div>
                  )}

                  {editable && (
                    <Button
                      onClick={() => void handleSubmitOrder(order.orderId)}
                      disabled={isSubmitting}
                      className="mt-5 h-11 w-full rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                      {isSubmitting ? 'Starting checkout...' : 'Start checkout'}
                    </Button>
                  )}

                  {(order.status === 'submited' || order.status === 'waiting_payment') && (
                    <Button
                      onClick={() => history.push(`/order/${order.orderId}/checkout`)}
                      className="mt-5 h-11 w-full rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                    >
                      Continue checkout <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}

                  {order.status === 'finished' && (
                    <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Payment confirmed
                    </div>
                  )}
                </aside>
              </div>
            </article>
          )
        })}
      </div>

      {visibleOrders.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-800">No orders in this view</p>
          <p className="mt-1 text-sm text-slate-500">Choose another filter to see your orders.</p>
        </div>
      )}
    </div>
  )
}

export default OrderList
