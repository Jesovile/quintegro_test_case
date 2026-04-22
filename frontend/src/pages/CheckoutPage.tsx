import React, { useEffect, useReducer } from 'react'
import { Redirect, useHistory, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { GET_ORDER, GET_ORDERS } from '../graphql/queries'
import {
  CANCEL_CHECKOUT,
  PLACE_ORDER,
  START_CHECKOUT,
  UPDATE_CHECKOUT
} from '../graphql/mutations'
import { Order, Shipping } from '../types/order'
import CheckoutStepper, { CheckoutStep } from '../components/checkout/CheckoutStepper'
import ReviewStep from '../components/checkout/ReviewStep'
import ShippingForm from '../components/checkout/ShippingForm'
import PaymentForm, { CardDraft } from '../components/checkout/PaymentForm'
import ConfirmStep from '../components/checkout/ConfirmStep'

interface WizardState {
  step: CheckoutStep
  shipping: Shipping | null
  card: CardDraft | null
  placeError: string | null
}

type WizardAction =
  | { type: 'SET_STEP'; step: CheckoutStep }
  | { type: 'SET_SHIPPING'; shipping: Shipping }
  | { type: 'SET_CARD'; card: CardDraft }
  | { type: 'SET_PLACE_ERROR'; error: string | null }
  | { type: 'HYDRATE_SHIPPING'; shipping: Shipping }

const initialState: WizardState = {
  step: 'review',
  shipping: null,
  card: null,
  placeError: null
}

const reducer = (state: WizardState, action: WizardAction): WizardState => {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, placeError: null }
    case 'SET_SHIPPING':
      return { ...state, shipping: action.shipping }
    case 'SET_CARD':
      return { ...state, card: action.card }
    case 'SET_PLACE_ERROR':
      return { ...state, placeError: action.error }
    case 'HYDRATE_SHIPPING':
      return state.shipping ? state : { ...state, shipping: action.shipping }
    default:
      return state
  }
}

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const [state, dispatch] = useReducer(reducer, initialState)

  const { data, loading, error, refetch } = useQuery<{ order: Order | null }>(GET_ORDER, {
    variables: { orderId },
    fetchPolicy: 'cache-and-network'
  })

  const [startCheckout] = useMutation(START_CHECKOUT, {
    variables: { orderId },
    refetchQueries: [{ query: GET_ORDERS }]
  })

  const [updateCheckout, { loading: updatingCheckout }] = useMutation(UPDATE_CHECKOUT, {
    refetchQueries: [{ query: GET_ORDERS }]
  })

  const [placeOrder, { loading: placingOrder }] = useMutation(PLACE_ORDER, {
    refetchQueries: [{ query: GET_ORDERS }]
  })

  const [cancelCheckout, { loading: cancelingCheckout }] = useMutation(CANCEL_CHECKOUT, {
    variables: { orderId },
    refetchQueries: [{ query: GET_ORDERS }]
  })

  const order = data?.order ?? null

  useEffect(() => {
    if (!order) return
    if (order.status === 'created') {
      startCheckout().catch(() => refetch())
    }
  }, [order?.orderId, order?.status])

  useEffect(() => {
    if (order?.shipping) {
      dispatch({ type: 'HYDRATE_SHIPPING', shipping: order.shipping })
    }
  }, [order?.shipping])

  if (loading && !order) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        <p className="text-sm font-medium">{error.message}</p>
      </div>
    )
  }

  if (!order) {
    return <Redirect to="/order/current" />
  }

  if (order.status === 'submited' || order.status === 'finished' || order.status === 'canceled') {
    return <Redirect to="/order/history" />
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This moves it to history and cannot be undone.')) return
    try {
      await cancelCheckout()
      history.replace('/order/history')
    } catch (e) {
      console.error(e)
    }
  }

  const handleShippingSubmit = async (shipping: Shipping) => {
    try {
      await updateCheckout({ variables: { orderId, shipping } })
      dispatch({ type: 'SET_SHIPPING', shipping })
      dispatch({ type: 'SET_STEP', step: 'payment' })
    } catch (e: any) {
      console.error(e)
    }
  }

  const handleCardSubmit = (card: CardDraft) => {
    dispatch({ type: 'SET_CARD', card })
    dispatch({ type: 'SET_STEP', step: 'confirm' })
  }

  const handlePlace = async () => {
    if (!state.card) return
    dispatch({ type: 'SET_PLACE_ERROR', error: null })
    try {
      await placeOrder({ variables: { orderId, card: state.card } })
      history.replace('/order/history')
    } catch (e: any) {
      dispatch({
        type: 'SET_PLACE_ERROR',
        error: e?.message?.replace(/^PAYMENT_FAILED:\s*/, '') || 'Payment failed'
      })
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Checkout</h1>

      <CheckoutStepper current={state.step} />

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        {state.step === 'review' && (
          <ReviewStep
            order={order}
            onNext={() => dispatch({ type: 'SET_STEP', step: 'shipping' })}
            onCancel={handleCancel}
          />
        )}

        {state.step === 'shipping' && (
          <ShippingForm
            initial={state.shipping ?? order.shipping ?? null}
            busy={updatingCheckout}
            onBack={() => dispatch({ type: 'SET_STEP', step: 'review' })}
            onSubmit={handleShippingSubmit}
            onCancel={handleCancel}
          />
        )}

        {state.step === 'payment' && (
          <PaymentForm
            initial={state.card}
            onBack={() => dispatch({ type: 'SET_STEP', step: 'shipping' })}
            onSubmit={handleCardSubmit}
            onCancel={handleCancel}
          />
        )}

        {state.step === 'confirm' && state.shipping && state.card && (
          <ConfirmStep
            order={order}
            shipping={state.shipping}
            card={state.card}
            busy={placingOrder || cancelingCheckout}
            error={state.placeError}
            onBack={() => dispatch({ type: 'SET_STEP', step: 'payment' })}
            onPlace={handlePlace}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  )
}

export default CheckoutPage
