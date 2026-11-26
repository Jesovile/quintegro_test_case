import { describe, expect, it } from 'vitest'
import {
  EMPTY_CARD,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  normalizeCardNumber,
  passesLuhn,
  validateCard,
  validateCardName,
  validateCardNumber,
  validateCvc,
  validateExpiry,
} from './card'

// Public test card numbers published by payment processors.
const VISA = '4242424242424242'
const VISA_13 = '4222222222222'
const MASTERCARD = '5555555555554444'
const MASTERCARD_2_SERIES = '2223003122003222'
const AMEX = '378282246310005'
const DISCOVER = '6011111111111117'

describe('detectCardBrand', () => {
  it.each([
    [VISA, 'visa'],
    [MASTERCARD, 'mastercard'],
    [MASTERCARD_2_SERIES, 'mastercard'],
    ['2720', 'mastercard'],
    [AMEX, 'amex'],
    ['34', 'amex'],
    [DISCOVER, 'discover'],
    ['65', 'discover'],
    ['644', 'discover'],
    ['2220', null], // just below the Mastercard 2-series range
    ['2721', null], // just above it
    ['50', null],
    ['9', null],
  ])('%s -> %s', (digits, brand) => {
    expect(detectCardBrand(digits)).toBe(brand)
  })
})

describe('formatting', () => {
  it('keeps only digits and caps at 19', () => {
    expect(normalizeCardNumber('4242 4242-4242.4242')).toBe(VISA)
    expect(normalizeCardNumber('1'.repeat(25))).toHaveLength(19)
  })

  it('groups 4-4-4-4 for Visa and 4-6-5 for Amex', () => {
    expect(formatCardNumber(VISA)).toBe('4242 4242 4242 4242')
    expect(formatCardNumber('42424')).toBe('4242 4')
    expect(formatCardNumber(AMEX)).toBe('3782 822463 10005')
  })

  it('cuts extra digits for a known brand', () => {
    expect(formatCardNumber(`${AMEX}999`)).toBe('3782 822463 10005')
  })

  it.each([
    ['', ''],
    ['1', '1'],
    ['4', '04'], // a month can't start with 4
    ['12', '12'],
    ['123', '12 / 3'],
    ['1230', '12 / 30'],
    ['12/2030', '12 / 30'], // browser autofill format
    ['12 / 30', '12 / 30'],
    ['123456', '12 / 34'],
  ])('expiry %s -> %s', (input, out) => {
    expect(formatExpiry(input)).toBe(out)
  })
})

describe('validateCardNumber', () => {
  it.each([VISA, VISA_13, MASTERCARD, MASTERCARD_2_SERIES, AMEX, DISCOVER])('accepts %s', (n) => {
    expect(passesLuhn(n)).toBe(true)
    expect(validateCardNumber(n)).toBeUndefined()
  })

  it('asks for a number when empty', () => {
    expect(validateCardNumber('')).toBe('Enter your card number')
  })

  it('rejects unsupported brands', () => {
    expect(validateCardNumber('3530111333300000')).toBe('We accept Visa, Mastercard, American Express and Discover')
  })

  it('rejects incomplete numbers', () => {
    expect(validateCardNumber('424242424242')).toBe('Your card number is incomplete')
    expect(validateCardNumber('37828224631000')).toBe('Your card number is incomplete')
  })

  it('rejects a typo via the Luhn checksum', () => {
    expect(validateCardNumber('4242424242424241')).toBe('Check your card number')
  })
})

describe('validateExpiry', () => {
  const now = new Date(2026, 10, 26) // Nov 26, 2026

  it('accepts the current month and future dates', () => {
    expect(validateExpiry('11 / 26', now)).toBeUndefined()
    expect(validateExpiry('01 / 31', now)).toBeUndefined()
  })

  it.each([
    ['', 'Enter the expiration date'],
    ['1', 'Enter the date as MM / YY'],
    ['13 / 30', 'Enter a valid month'],
    ['00 / 30', 'Enter a valid month'],
    ['10 / 26', 'Your card has expired'],
    ['12 / 25', 'Your card has expired'],
    ['12 / 50', 'Check the expiration year'],
  ])('%s -> %s', (value, error) => {
    expect(validateExpiry(value, now)).toBe(error)
  })
})

describe('validateCvc', () => {
  it('needs 3 digits for Visa and 4 for Amex', () => {
    expect(validateCvc('123', VISA)).toBeUndefined()
    expect(validateCvc('1234', VISA)).toBe('Enter the 3-digit security code')
    expect(validateCvc('1234', AMEX)).toBeUndefined()
    expect(validateCvc('123', AMEX)).toBe('Enter the 4-digit security code')
    expect(validateCvc('', VISA)).toBe('Enter the security code')
  })
})

describe('validateCardName', () => {
  it('validates the cardholder name', () => {
    expect(validateCardName('Alex Smith')).toBeUndefined()
    expect(validateCardName('')).toBe('Enter the name on your card')
    expect(validateCardName('A')).toBe('Name must be at least 2 characters')
    expect(validateCardName('4242')).toBe('Enter the name as it appears on your card')
  })
})

describe('validateCard', () => {
  it('reports all fields on an empty form, in focus order', () => {
    expect(Object.keys(validateCard(EMPTY_CARD))).toEqual(['number', 'expiry', 'cvc', 'name'])
  })

  it('passes a complete card', () => {
    const now = new Date(2026, 10, 26)
    expect(validateCard({ number: VISA, expiry: '12 / 30', cvc: '123', name: 'Alex Smith' }, now)).toEqual({})
  })
})
