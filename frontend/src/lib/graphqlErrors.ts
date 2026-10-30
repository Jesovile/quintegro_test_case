import { ApolloError } from '@apollo/client'

const ERROR_MESSAGES: Record<string, string> = {
  ORDER_NOT_FOUND: 'This order could not be found.',
  ORDER_NOT_EDITABLE: 'This order can no longer be changed.',
  UNAUTHENTICATED: 'Please sign in to continue.'
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export const getErrorCode = (error: ApolloError): string | undefined => {
  const code = error.graphQLErrors[0]?.extensions?.code
  return typeof code === 'string' ? code : undefined
}

export const getErrorMessage = (error: ApolloError): string => {
  const code = getErrorCode(error)
  return (code && ERROR_MESSAGES[code]) || DEFAULT_ERROR_MESSAGE
}
