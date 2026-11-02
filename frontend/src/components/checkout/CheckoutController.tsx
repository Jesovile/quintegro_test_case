import React from 'react'
import { Link, Redirect, useHistory, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { GET_ORDER } from '@/graphql/queries'
import { EXIT_CHECKOUT } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views'
import { checkoutPath, resolveStep } from '@/lib/checkoutSteps'
import { getErrorCode, getErrorMessage } from '@/lib/graphqlErrors'
import { CheckoutStep, Order } from '@/types/order'
import CheckoutStepper from './CheckoutStepper'
import OrderSummary from './OrderSummary'
import CheckoutStepPlaceholder from './CheckoutStepPlaceholder'

const backToOrders = (
  <Button asChild variant="outline" className="mt-4">
    <Link to="/order">Back to orders</Link>
  </Button>
)

const renderStep = (step: CheckoutStep, order: Order) => {
  switch (step) {
    case 'delivery':
      return <CheckoutStepPlaceholder title="Delivery" description="Contact and delivery address will be entered here." />
    case 'payment':
      return <CheckoutStepPlaceholder title="Payment" description="Payment details will be entered here." />
    case 'processing':
      return <CheckoutStepPlaceholder title="Processing" description={`Order #${order.orderId} is being processed.`} />
    case 'success':
      return (
        <CheckoutStepPlaceholder title="Thank you!" description={`Order #${order.orderId} has been placed.`}>
          <Button asChild className="mt-4">
            <Link to="/">Continue shopping</Link>
          </Button>
        </CheckoutStepPlaceholder>
      )
  }
}

// The only component that knows about checkout steps: it picks the step from the order state
const CheckoutController: React.FC = () => {
  const { orderId, step } = useParams<{ orderId: string; step?: string }>()
  const history = useHistory()

  const { data, loading, error, refetch } = useQuery(GET_ORDER, { variables: { orderId } })
  const [exitCheckout, exitState] = useMutation(EXIT_CHECKOUT, {
    onCompleted: () => history.push('/order'),
    // Failures are shown from exitState.error
    onError: () => undefined
  })

  if (loading && !data) {
    return <LoadingState label="Loading checkout..." />
  }

  const order = data?.order

  if (!order) {
    // A rejected session is redirected to login by UnauthenticatedRedirect
    if (error && getErrorCode(error) !== 'ORDER_NOT_FOUND') {
      return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
    }
    return <EmptyState title="Order not found" description="This order does not exist or is not yours." action={backToOrders} />
  }

  if (order.status === 'created') {
    return <Redirect to="/order" />
  }

  if (order.status === 'cancelled') {
    return <EmptyState title="Order cancelled" description={`Order #${order.orderId} has been cancelled.`} action={backToOrders} />
  }

  const currentStep = resolveStep(order, step)
  if (currentStep && currentStep !== step) {
    return <Redirect to={checkoutPath(order.orderId, currentStep)} />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        {order.status === 'checkout' && (
          <Button
            variant="outline"
            className="min-w-[9rem]"
            loading={exitState.loading}
            onClick={() => exitCheckout({ variables: { orderId: order.orderId } })}
          >
            Back to order
          </Button>
        )}
      </div>
      {exitState.error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {getErrorMessage(exitState.error)}
        </p>
      )}
      {currentStep && currentStep !== 'success' && <CheckoutStepper order={order} currentStep={currentStep} />}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="checkout-step-title">{currentStep && renderStep(currentStep, order)}</section>
        <OrderSummary order={order} />
      </div>
    </div>
  )
}

export default CheckoutController
