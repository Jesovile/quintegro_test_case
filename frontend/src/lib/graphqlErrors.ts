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
  return !code || code === 'INTERNAL' || code === 'GEO_UNAVAILABLE'
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
