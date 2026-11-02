import { describe, expect, it } from 'vitest'
import { isExpiryInFuture, passesLuhn, validateCardForm } from './cardValidation'
import { MockCardTokenizer, TEST_CARDS } from '@/integrations/cardTokenizer'

const now = new Date(2026, 10, 2)

describe('card validation (AC-3.1)', () => {
  it('accepts the test cards with spaces', () => {
    expect(validateCardForm({ cardNumber: '4111 1111 1111 1111', expiry: '12/27', cvc: '123' }, now)).toEqual({})
  })

  it('checks the Luhn digit', () => {
    expect(passesLuhn(TEST_CARDS.approve)).toBe(true)
    expect(passesLuhn(TEST_CARDS.decline)).toBe(true)
    expect(passesLuhn('4111111111111112')).toBe(false)
  })

  it('reports every invalid field', () => {
    expect(Object.keys(validateCardForm({ cardNumber: '1234', expiry: '13/27', cvc: '12' }, now)).sort()).toEqual([
      'cardNumber',
      'cvc',
      'expiry'
    ])
  })

  it('treats a card as valid through its expiry month', () => {
    expect(isExpiryInFuture('11/26', now)).toBe(true)
    expect(isExpiryInFuture('10/26', now)).toBe(false)
    expect(validateCardForm({ cardNumber: TEST_CARDS.approve, expiry: '10/26', cvc: '123' }, now).expiry).toBe('This card has expired')
  })
})

describe('mock card tokenizer', () => {
  it('maps the test cards to bank scenarios without exposing the number', async () => {
    const tokenizer = new MockCardTokenizer(0)
    const tokenFor = async (cardNumber: string) => (await tokenizer.tokenizeCard({ cardNumber, expiry: '12/27', cvc: '123' })).cardToken

    expect(await tokenFor(TEST_CARDS.decline)).toMatch(/^tok_decline_/)
    expect(await tokenFor(TEST_CARDS.timeout)).toMatch(/^tok_timeout_/)
    const approved = await tokenFor('4111 1111 1111 1111')
    expect(approved).toMatch(/^tok_approve_/)
    expect(approved).not.toContain('4111')
  })
})
