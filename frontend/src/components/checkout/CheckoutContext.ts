import { createContext, useContext } from 'react'

export interface ExistingPayment {
  paymentId: string
  paymentUrl: string
}

export interface CheckoutContextType {
  openCheckout: (orderId: string, existingPayment?: ExistingPayment) => void
}

export const CheckoutContext = createContext<CheckoutContextType | null>(null)

export function useCheckout(): CheckoutContextType {
  const ctx = useContext(CheckoutContext)
  if (!ctx) throw new Error('useCheckout must be used within CheckoutContext.Provider')
  return ctx
}
