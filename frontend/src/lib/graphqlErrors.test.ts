import { describe, expect, it } from 'vitest'
import { ApolloError } from '@apollo/client'
import { GraphQLError } from 'graphql'
import { getErrorCode, getErrorMessage } from './graphqlErrors'

const withCode = (code: unknown) =>
  new ApolloError({ graphQLErrors: [new GraphQLError('boom', { extensions: { code } })] })

describe('getErrorCode', () => {
  it('returns the code of the first GraphQL error', () => {
    expect(getErrorCode(withCode('ORDER_NOT_EDITABLE'))).toBe('ORDER_NOT_EDITABLE')
  })

  it('returns undefined for a network error without GraphQL errors', () => {
    expect(getErrorCode(new ApolloError({ networkError: new Error('offline') }))).toBeUndefined()
  })

  it('returns undefined when the code is not a string', () => {
    expect(getErrorCode(withCode(42))).toBeUndefined()
  })
})

describe('getErrorMessage (AC-6.1)', () => {
  it('maps ORDER_NOT_EDITABLE to a readable message', () => {
    expect(getErrorMessage(withCode('ORDER_NOT_EDITABLE'))).toBe('This order can no longer be changed.')
  })

  it('maps ORDER_NOT_FOUND and UNAUTHENTICATED', () => {
    expect(getErrorMessage(withCode('ORDER_NOT_FOUND'))).toBe('This order could not be found.')
    expect(getErrorMessage(withCode('UNAUTHENTICATED'))).toBe('Please sign in to continue.')
  })

  it('falls back to the default message for unknown codes and network errors', () => {
    const fallback = 'Something went wrong. Please try again.'

    expect(getErrorMessage(withCode('SOMETHING_ELSE'))).toBe(fallback)
    expect(getErrorMessage(new ApolloError({ networkError: new Error('x') }))).toBe(fallback)
  })

  it('does not leak the raw server message', () => {
    expect(getErrorMessage(withCode('INTERNAL'))).not.toContain('boom')
  })
})
