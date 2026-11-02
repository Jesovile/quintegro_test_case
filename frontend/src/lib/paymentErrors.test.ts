import { describe, expect, it } from 'vitest'
import { ApolloError } from '@apollo/client'
import { GraphQLError } from 'graphql'
import { getErrorMessage, isRetryable } from './graphqlErrors'

const withCode = (code: string) =>
  new ApolloError({ graphQLErrors: [new GraphQLError('boom', { extensions: { code } })] })

describe('payment error codes (AC-3.3, AC-3.4, AC-3.7)', () => {
  it('offers a retry for PAYMENT_UNAVAILABLE and PAYMENT_UNCONFIRMED', () => {
    expect(isRetryable(withCode('PAYMENT_UNAVAILABLE'))).toBe(true)
    expect(isRetryable(withCode('PAYMENT_UNCONFIRMED'))).toBe(true)
  })

  it('does not offer a plain retry for a decline or a changed total', () => {
    expect(isRetryable(withCode('PAYMENT_DECLINED'))).toBe(false)
    expect(isRetryable(withCode('TOTAL_CHANGED'))).toBe(false)
  })

  it('has readable messages for every payment code', () => {
    for (const code of ['PAYMENT_DECLINED', 'PAYMENT_UNAVAILABLE', 'PAYMENT_UNCONFIRMED', 'TOTAL_CHANGED']) {
      const message = getErrorMessage(withCode(code))
      expect(message).not.toBe('Something went wrong. Please try again.')
      expect(message).not.toContain('boom')
    }
  })
})
