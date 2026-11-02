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

  it('cancellation codes have readable messages (AC-5.3, AC-5.4)', () => {
    for (const code of ['REFUND_FAILED', 'REFUND_PENDING', 'ORDER_NOT_CANCELLABLE']) {
      const message = getErrorMessage(withCode(code))
      expect(message).not.toBe('Something went wrong. Please try again.')
      expect(message).not.toContain('boom')
    }
    expect(getErrorMessage(withCode('REFUND_FAILED'))).toMatch(/not cancelled/)
    expect(getErrorMessage(withCode('ORDER_NOT_CANCELLABLE'))).toMatch(/can no longer be cancelled/)
  })

  it('REFUND_FAILED offers "Try again", ORDER_NOT_CANCELLABLE and REFUND_PENDING do not (AC-5.3)', () => {
    expect(isRetryable(withCode('REFUND_FAILED'))).toBe(true)
    expect(isRetryable(withCode('ORDER_NOT_CANCELLABLE'))).toBe(false)
    expect(isRetryable(withCode('REFUND_PENDING'))).toBe(false)
  })

  it('has readable messages for every payment code', () => {
    for (const code of ['PAYMENT_DECLINED', 'PAYMENT_UNAVAILABLE', 'PAYMENT_UNCONFIRMED', 'TOTAL_CHANGED']) {
      const message = getErrorMessage(withCode(code))
      expect(message).not.toBe('Something went wrong. Please try again.')
      expect(message).not.toContain('boom')
    }
  })
})
