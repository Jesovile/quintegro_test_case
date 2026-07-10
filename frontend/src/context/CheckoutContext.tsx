import React, { createContext, useContext, useReducer } from 'react'

export type CheckoutStep = 'address' | 'review' | 'payment' | 'confirmation'

// Matches backend `DeliveryAddress` (backend/src/types/entities.ts) verbatim —
// tech-design §2.1 frozen contract.
export interface DeliveryAddress {
  recipientName: string
  phone: string
  country: string
  city: string
  street: string
  building: string
  apartment?: string
  postalCode: string
}

export type DeliveryMethodType = 'regular' | 'extra'

// This context is client-side convenience state only (pre-filling forms on
// back-navigation, AC-201-5); the backend order record is always the source
// of truth for anything already committed. See tech-design §6.2.
export interface CheckoutState {
  orderId: string | null
  address: DeliveryAddress | null
  deliveryMethodType: DeliveryMethodType | null
  step: CheckoutStep
}

export type CheckoutAction =
  | { type: 'SET_STEP'; step: CheckoutStep }
  | { type: 'SET_ORDER_ID'; orderId: string }
  | { type: 'SET_DELIVERY'; address: DeliveryAddress; deliveryMethodType: DeliveryMethodType }
  | { type: 'RESET' }

const initialState: CheckoutState = {
  orderId: null,
  address: null,
  deliveryMethodType: null,
  step: 'address'
}

function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_ORDER_ID':
      return { ...state, orderId: action.orderId }
    case 'SET_DELIVERY':
      return { ...state, address: action.address, deliveryMethodType: action.deliveryMethodType }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

interface CheckoutContextValue {
  state: CheckoutState
  dispatch: React.Dispatch<CheckoutAction>
}

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined)

export const CheckoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(checkoutReducer, initialState)

  return (
    <CheckoutContext.Provider value={{ state, dispatch }}>
      {children}
    </CheckoutContext.Provider>
  )
}

export const useCheckout = (): CheckoutContextValue => {
  const context = useContext(CheckoutContext)
  if (!context) {
    throw new Error('useCheckout must be used within a CheckoutProvider')
  }
  return context
}
