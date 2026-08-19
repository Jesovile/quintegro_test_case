import React, { createContext, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Address, DeliveryOption, PaymentMethod, ReserveResult, PaymentResult } from '@/types/checkout'

interface CheckoutState {
  orderId: string
  address: Address | null
  deliveryOption: DeliveryOption | null
  paymentMethod: PaymentMethod | null
  reservation: ReserveResult | null
  paymentResult: PaymentResult | null
  submitFailed: boolean
  setAddress: (address: Address) => void
  setDeliveryOption: (option: DeliveryOption) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setReservation: (reservation: ReserveResult | null) => void
  setPaymentResult: (result: PaymentResult | null) => void
  setSubmitFailed: (value: boolean) => void
  reset: () => void
}

const CheckoutContext = createContext<CheckoutState | null>(null)

export const CheckoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { orderId } = useParams<{ orderId: string }>()
  const [activeOrderId, setActiveOrderId] = useState(orderId)

  const [address, setAddress] = useState<Address | null>(null)
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [reservation, setReservation] = useState<ReserveResult | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [submitFailed, setSubmitFailed] = useState(false)

  const reset = () => {
    setAddress(null)
    setDeliveryOption(null)
    setPaymentMethod(null)
    setReservation(null)
    setPaymentResult(null)
    setSubmitFailed(false)
  }

  // Сброс состояния при переходе к чекауту другого заказа напрямую по URL.
  useEffect(() => {
    if (orderId !== activeOrderId) {
      reset()
      setActiveOrderId(orderId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, activeOrderId])

  return (
    <CheckoutContext.Provider
      value={{
        orderId,
        address,
        deliveryOption,
        paymentMethod,
        reservation,
        paymentResult,
        submitFailed,
        setAddress,
        setDeliveryOption,
        setPaymentMethod,
        setReservation,
        setPaymentResult,
        setSubmitFailed,
        reset,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  )
}

export const useCheckout = (): CheckoutState => {
  const ctx = useContext(CheckoutContext)
  if (!ctx) {
    throw new Error('useCheckout must be used within CheckoutProvider')
  }
  return ctx
}
