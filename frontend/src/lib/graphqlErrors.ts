import { ApolloError } from '@apollo/client'

const ERROR_MESSAGES: Record<string, string> = {
  ORDER_NOT_FOUND: 'This order could not be found.',
  ORDER_NOT_EDITABLE: 'This order can no longer be changed.',
  ORDER_EMPTY: 'Your order is empty.',
  INVALID_STATUS_TRANSITION: 'This order has changed. Reload the page to see its current state.',
  VALIDATION_FAILED: 'Some fields need your attention.',
  ADDRESS_REJECTED: 'We could not verify this address.',
  GEO_UNAVAILABLE: 'We could not check the address right now. Please try again.',
  ADDRESS_NOT_FOUND: 'Your saved address is no longer available. Please enter it again.',
  DELIVERY_REQUIRED: 'Please enter delivery details first.',
  TOTAL_CHANGED: 'The order total has changed. Please review the new total and pay again.',
  PAYMENT_DECLINED: 'Your card was declined. Please use another card.',
  PAYMENT_UNAVAILABLE: 'The payment service is unavailable. Please try again.',
  PAYMENT_UNCONFIRMED: 'We could not confirm your payment yet. Use "Try again" to check it; your card will not be charged twice.',
  PAYMENT_IN_PROGRESS: 'A payment for this order is in progress. Please wait a moment and try again.',
  PAYMENT_REFUNDED: 'The order changed while you were paying, so the charge was refunded. Please review the order and pay again.',
  REFUND_PENDING: 'The order changed while you were paying. The refund of that charge is pending; you will not lose the money.',
  REFUND_FAILED: 'We could not refund your payment right now, so the order was not cancelled. Please try again.',
  ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled.',
  CANCEL_UNAVAILABLE: 'We could not cancel the order right now. Please try again.',
  REFUND_UNCONFIRMED: 'We are confirming the refund with the bank. The order will be cancelled shortly.',
  PROCESSING_FAILED: 'We could not restart processing. Please try again in a moment.',
  PROMO_NOT_FOUND: 'This promo code does not exist.',
  PROMO_EXPIRED: 'This promo code has expired.',
  UNAUTHENTICATED: 'Please sign in to continue.'
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export const getErrorCode = (error: ApolloError): string | undefined => {
  const code = error.graphQLErrors[0]?.extensions?.code
  return typeof code === 'string' ? code : undefined
}

// Failures where repeating the same request can help (outage, network); other codes need a different action
export const isRetryable = (error: ApolloError): boolean => {
  const code = getErrorCode(error)
  return !code || ['INTERNAL', 'GEO_UNAVAILABLE', 'PAYMENT_UNAVAILABLE', 'PAYMENT_UNCONFIRMED', 'PAYMENT_IN_PROGRESS', 'REFUND_FAILED', 'CANCEL_UNAVAILABLE'].includes(code)
}

export const getErrorMessage = (error: ApolloError): string => {
  const code = getErrorCode(error)
  return (code && ERROR_MESSAGES[code]) || DEFAULT_ERROR_MESSAGE
}

// Field errors reported by the server, keyed by the field path, e.g. "address.zip"
export const getFieldErrors = (error: ApolloError): Record<string, string> => {
  const fields = error.graphQLErrors[0]?.extensions?.fields
  if (!Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(
    fields
      .filter((item): item is { field: string; message: string } =>
        typeof item?.field === 'string' && typeof item?.message === 'string')
      .map(({ field, message }) => [field, message])
  )
}
