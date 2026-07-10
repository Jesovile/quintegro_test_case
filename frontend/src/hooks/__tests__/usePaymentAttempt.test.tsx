import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MockedProvider, MockedResponse } from '@apollo/client/testing'
import { GraphQLError } from 'graphql'
import { usePaymentAttempt } from '../usePaymentAttempt'
import { PAY } from '../../graphql/mutations'

const VALID_CARD = {
  cardNumber: '4242424242424242',
  expiry: '09/30',
  cvv: '123',
  cardholderName: 'Jane Doe'
}

function wrapperWith(mocks: MockedResponse[]) {
  return ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  )
}

// crypto.randomUUID is deterministically stubbed per-test so the mocked
// mutation's `variables` (which must deep-equal the actual call for
// MockedProvider to resolve it) can be predicted.
function stubIdempotencyKeys(...keys: string[]) {
  const spy = vi.spyOn(crypto, 'randomUUID')
  keys.forEach(key => {
    spy.mockImplementationOnce(() => key as `${string}-${string}-${string}-${string}-${string}`)
  })
  return spy
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePaymentAttempt', () => {
  it('transitions entering -> processing -> success for a mocked successful PAY response', async () => {
    stubIdempotencyKeys('key-1')

    const successMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'key-1', card: VALID_CARD } },
      result: {
        data: {
          pay: {
            order: { orderId: 'order-2', status: 'paid' },
            payment: { paymentId: 'payment-1', status: 'succeeded', cardLast4: '4242', cardholderName: 'Jane Doe', failureReason: null, createdAt: 1 }
          }
        }
      }
    }

    const { result } = renderHook(() => usePaymentAttempt('order-2'), { wrapper: wrapperWith([successMock]) })

    expect(result.current.state).toEqual({ phase: 'entering' })

    act(() => {
      result.current.submit(VALID_CARD)
    })

    expect(result.current.state).toEqual({ phase: 'processing' })

    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(result.current.state).toEqual({ phase: 'success', order: { orderId: 'order-2', status: 'paid' } })
  })

  it("transitions entering -> processing -> failure for a mocked payment.status: 'failed' response, message from failureReason", async () => {
    stubIdempotencyKeys('key-1')

    const declineMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'key-1', card: VALID_CARD } },
      result: {
        data: {
          pay: {
            order: { orderId: 'order-2', status: 'created' },
            payment: { paymentId: 'payment-1', status: 'failed', cardLast4: '4242', cardholderName: 'Jane Doe', failureReason: 'Card declined by issuer (mock)', createdAt: 1 }
          }
        }
      }
    }

    const { result } = renderHook(() => usePaymentAttempt('order-2'), { wrapper: wrapperWith([declineMock]) })

    act(() => {
      result.current.submit(VALID_CARD)
    })

    await waitFor(() => expect(result.current.state.phase).toBe('failure'))
    expect(result.current.state).toEqual({
      phase: 'failure',
      message: 'Card declined by issuer (mock)',
      retryable: true
    })
  })

  it('transitions entering -> processing -> failure with the same shape for an Apollo network/GraphQL error (AC-404-5)', async () => {
    stubIdempotencyKeys('key-1')

    const errorMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'key-1', card: VALID_CARD } },
      result: { errors: [new GraphQLError('Test planned server error')] }
    }

    const { result } = renderHook(() => usePaymentAttempt('order-2'), { wrapper: wrapperWith([errorMock]) })

    act(() => {
      result.current.submit(VALID_CARD)
    })

    await waitFor(() => expect(result.current.state.phase).toBe('failure'))
    expect(result.current.state).toEqual({
      phase: 'failure',
      message: 'Something went wrong processing your payment. Please try again.',
      retryable: true
    })
  })

  it('two consecutive submit calls use two different idempotency keys', async () => {
    stubIdempotencyKeys('key-1', 'key-2')

    const capturedKeys: string[] = []
    const mockFor = (key: string): MockedResponse => ({
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: key, card: VALID_CARD } },
      result: () => {
        capturedKeys.push(key)
        return {
          data: {
            pay: {
              order: { orderId: 'order-2', status: 'paid' },
              payment: { paymentId: 'payment-1', status: 'succeeded', cardLast4: '4242', cardholderName: 'Jane Doe', failureReason: null, createdAt: 1 }
            }
          }
        }
      }
    })

    const { result } = renderHook(() => usePaymentAttempt('order-2'), {
      wrapper: wrapperWith([mockFor('key-1'), mockFor('key-2')])
    })

    await act(async () => {
      await result.current.submit(VALID_CARD)
    })

    act(() => {
      result.current.reset()
    })

    await act(async () => {
      await result.current.submit(VALID_CARD)
    })

    expect(capturedKeys).toEqual(['key-1', 'key-2'])
  })

  it('reset() returns state to { phase: "entering" }', async () => {
    stubIdempotencyKeys('key-1')

    const declineMock: MockedResponse = {
      request: { query: PAY, variables: { orderId: 'order-2', idempotencyKey: 'key-1', card: VALID_CARD } },
      result: {
        data: {
          pay: {
            order: { orderId: 'order-2', status: 'created' },
            payment: { paymentId: 'payment-1', status: 'failed', cardLast4: '4242', cardholderName: 'Jane Doe', failureReason: 'Card declined by issuer (mock)', createdAt: 1 }
          }
        }
      }
    }

    const { result } = renderHook(() => usePaymentAttempt('order-2'), { wrapper: wrapperWith([declineMock]) })

    await act(async () => {
      await result.current.submit(VALID_CARD)
    })

    expect(result.current.state.phase).toBe('failure')

    act(() => {
      result.current.reset()
    })

    expect(result.current.state).toEqual({ phase: 'entering' })
  })
})
