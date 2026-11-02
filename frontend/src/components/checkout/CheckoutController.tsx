import React from 'react'
import { Link, Redirect, useHistory, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { GET_CHECKOUT_ORDER, GET_ORDER } from '@/graphql/queries'
import { EXIT_CHECKOUT } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-views'
import { CHECKOUT_STEP_HEADING_ID, STEP_LABELS, checkoutPath, resolveStep } from '@/lib/checkoutSteps'
import { getErrorCode, getErrorMessage } from '@/lib/graphqlErrors'
import { Order } from '@/types/order'
import { useStepFocus } from '@/hooks/useStepFocus'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import CheckoutStepper from './CheckoutStepper'
import OrderSummary from './OrderSummary'
import DeliveryStep from './DeliveryStep'
import PaymentStep from './PaymentStep'
import ProcessingStep from './ProcessingStep'
import CheckoutSuccess from './CheckoutSuccess'
import CancelOrderDialog from '../CancelOrderDialog'

const POLL_INTERVAL_MS = 2000

const backToOrders = (
  <Button asChild variant="outline" className="mt-4">
    <Link to="/order">Back to orders</Link>
  </Button>
)

// The server moves a paid order on by itself; the page follows it until delivery or a failure that needs the user
const isMovingOnServer = (order: Order | null | undefined): boolean =>
  Boolean(order && (order.status === 'paid' || (order.status === 'processing' && !order.processingFailed)))

// The only component that knows about checkout steps: it picks the step from the order state
const CheckoutController: React.FC = () => {
  const { orderId, step } = useParams<{ orderId: string; step?: string }>()
  const history = useHistory()

  const { data, loading, error, refetch } = useQuery(GET_CHECKOUT_ORDER, { variables: { orderId } })

  // A light query without delivery: it refreshes the same cached order, so the step follows the server.
  // A failed poll (the test backend fails every 5th request) is repeated on the next interval; hidden tabs do not poll.
  useQuery(GET_ORDER, {
    variables: { orderId },
    skip: !isMovingOnServer(data?.order),
    pollInterval: POLL_INTERVAL_MS,
    skipPollAttempt: () => document.hidden,
    fetchPolicy: 'network-only'
  })

  // The step actually on screen: null while loading or while a redirect fixes the URL
  const shownOrder = data?.order
  const resolvedStep = shownOrder ? resolveStep(shownOrder, step) : null
  const shownStep = resolvedStep && resolvedStep === step ? resolvedStep : null
  const { announcement, markUserNavigation } = useStepFocus(shownStep)
  useDocumentTitle(shownStep && `Checkout: ${STEP_LABELS[shownStep]}`)

  const [exitCheckout, exitState] = useMutation(EXIT_CHECKOUT, {
    onCompleted: () => history.push('/order'),
    // Failures are shown from exitState.error. The order may have changed on the server
    // (e.g. an unanswered payment turned out to be paid), so the step is chosen from fresh data.
    onError: () => {
      refetch()
    }
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

  // Saved delivery that could not be read (Geo service down or address gone); the order itself loaded
  const deliveryLoadError = error && order.deliverySaved && !order.delivery ? error : undefined

  const currentStep = resolveStep(order, step)
  if (currentStep && currentStep !== step) {
    return <Redirect to={checkoutPath(order.orderId, currentStep)} />
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'delivery':
        return deliveryLoadError && getErrorCode(deliveryLoadError) !== 'ADDRESS_NOT_FOUND' ? (
          <ErrorState message={getErrorMessage(deliveryLoadError)} onRetry={() => refetch()} />
        ) : (
          <DeliveryStep
            order={order}
            delivery={order.delivery}
            defaultFullName={data?.me?.name ?? ''}
            notice={deliveryLoadError ? getErrorMessage(deliveryLoadError) : undefined}
            onSubmit={markUserNavigation}
            onSaved={() => history.push(checkoutPath(order.orderId, 'payment'))}
          />
        )
      case 'payment':
        return (
          <PaymentStep
            order={order}
            onSubmit={markUserNavigation}
            onPaid={() => history.push(checkoutPath(order.orderId, 'processing'))}
          />
        )
      case 'processing':
        return <ProcessingStep order={order} />
      case 'success':
        return <CheckoutSuccess order={order} />
      default:
        return null
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        <div className="flex flex-wrap gap-3">
          <CancelOrderDialog order={order} />
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
      </div>
      {exitState.error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {getErrorMessage(exitState.error)}
        </p>
      )}
      {/* Steps the server moves to by itself are announced here; focus stays where the user is */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {currentStep && currentStep !== 'success' && (
        <CheckoutStepper order={order} currentStep={currentStep} onNavigate={markUserNavigation} />
      )}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby={CHECKOUT_STEP_HEADING_ID}>{renderStep()}</section>
        <OrderSummary order={order} />
      </div>
    </div>
  )
}

export default CheckoutController
