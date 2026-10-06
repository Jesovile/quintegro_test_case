import React, { useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client'
import OrderList from '../components/OrderList'
import CheckoutFlow from '../components/checkout/CheckoutFlow'
import { CheckoutContext, ExistingPayment } from '../components/checkout/CheckoutContext'
import { GET_ORDERS } from '../graphql/queries'

interface CheckoutState {
  orderId: string
  initialPaymentInfo?: ExistingPayment
}

const OrderPage: React.FC = () => {
  const client = useApolloClient()
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null)

  const openCheckout = useCallback((orderId: string, existingPayment?: ExistingPayment) => {
    setCheckoutState({ orderId, initialPaymentInfo: existingPayment })
  }, [])

  const handleClose = useCallback(() => {
    setCheckoutState(null)
  }, [])

  const handleComplete = useCallback(async () => {
    await client.refetchQueries({ include: [GET_ORDERS] })
  }, [client])

  return (
    <CheckoutContext.Provider value={{ openCheckout }}>
      <OrderList />

      {checkoutState && (
        <CheckoutFlow
          orderId={checkoutState.orderId}
          onClose={handleClose}
          onComplete={handleComplete}
          initialPaymentInfo={checkoutState.initialPaymentInfo}
        />
      )}
    </CheckoutContext.Provider>
  )
}

export default OrderPage
