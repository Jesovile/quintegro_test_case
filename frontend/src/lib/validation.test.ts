import { describe, expect, it } from 'vitest'
import {
  Address,
  EMPTY_CONTACT_SHIPPING,
  formatAddress,
  formatUsPhone,
  normalizeUsPhone,
  toE164,
  validateAddress,
  validateContactShipping,
  validateEmail,
  validateFullName,
  validateUsPhone,
} from './validation'

describe('validateEmail', () => {
  it.each([
    'alex@example.com',
    'alex.smith+orders@mail.example.co.uk',
    '  alex@example.com  ', // surrounding whitespace is trimmed
    "o'brien@example.io",
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeUndefined()
  })

  it('asks for an email when empty', () => {
    expect(validateEmail('   ')).toBe('Enter your email address')
  })

  it.each([
    'alex',
    'alex@',
    '@example.com',
    'alex@example', // no TLD
    'alex@example.c', // 1-letter TLD
    'alex@@example.com',
    'alex smith@example.com',
    '.alex@example.com',
    'alex.@example.com',
    'al..ex@example.com',
    'alex@-example.com',
    'alex@example..com',
    `${'a'.repeat(65)}@example.com`, // local part > 64
  ])('rejects %s', (email) => {
    expect(validateEmail(email)).toBe('Enter a valid email, like name@example.com')
  })
})

describe('normalizeUsPhone / formatUsPhone', () => {
  it.each([
    ['6502137552', '6502137552'],
    ['(650) 213-7552', '6502137552'],
    ['+1 650 213 7552', '6502137552'],
    ['1-650-213-7552', '6502137552'],
    ['650.213.7552 ext 9', '6502137552'], // extra digits are cut at 10
    ['1', ''], // a lone country code is dropped
  ])('normalizes %s -> %s', (input, digits) => {
    expect(normalizeUsPhone(input)).toBe(digits)
  })

  it.each([
    ['', ''],
    ['6', '(6'],
    ['650', '(650'],
    ['6502', '(650) 2'],
    ['650213', '(650) 213'],
    ['6502137', '(650) 213-7'],
    ['6502137552', '(650) 213-7552'],
  ])('formats %s as %s', (digits, formatted) => {
    expect(formatUsPhone(digits)).toBe(formatted)
  })

  it('round-trips: formatting then normalizing gives the same digits', () => {
    expect(normalizeUsPhone(formatUsPhone('6502137552'))).toBe('6502137552')
  })

  it('builds E.164', () => {
    expect(toE164('6502137552')).toBe('+16502137552')
  })
})

describe('validateUsPhone', () => {
  it.each(['6502137552', '2125550123', '3105551234'])('accepts %s', (digits) => {
    expect(validateUsPhone(digits)).toBeUndefined()
  })

  it('asks for a phone when empty', () => {
    expect(validateUsPhone('')).toBe('Enter your phone number')
  })

  it('requires exactly 10 digits', () => {
    expect(validateUsPhone('650213755')).toBe('Enter a 10-digit US phone number')
  })

  it.each([
    ['0502137552', '050'], // area code starts with 0
    ['1502137552', '150'], // area code starts with 1
    ['9112137552', '911'], // N11 service code
    ['4112137552', '411'],
    ['2902137552', '290'], // N9X reserved
  ])('rejects area code in %s', (digits, area) => {
    expect(validateUsPhone(digits)).toBe(`${area} isn't a valid US area code`)
  })

  it.each([
    '6500137552', // exchange starts with 0
    '6501137552', // exchange starts with 1
    '6504117552', // N11 exchange
  ])('rejects exchange in %s', (digits) => {
    expect(validateUsPhone(digits)).toBe('Enter a valid US phone number')
  })
})

describe('validateFullName', () => {
  it.each(['Al', 'Alex Smith', 'José Álvarez', "Mary O'Neil-Smith", 'J. R. Tolkien', 'Иван Петров'])(
    'accepts %s',
    (name) => {
      expect(validateFullName(name)).toBeUndefined()
    },
  )

  it('asks for a name when empty', () => {
    expect(validateFullName('   ')).toBe('Enter your full name')
  })

  it('requires at least 2 characters after trimming', () => {
    expect(validateFullName('A')).toBe('Name must be at least 2 characters')
    expect(validateFullName(' A ')).toBe('Name must be at least 2 characters')
  })

  it.each(['R2D2', '-Alex', 'Alex@Smith', 'A'.repeat(101)])('rejects %s', (name) => {
    expect(validateFullName(name)).toBe('Enter a valid name')
  })
})

const ADDRESS: Address = { id: 'addr-01', line1: '1226 University Dr', city: 'Menlo Park', state: 'CA', zip: '94025' }

describe('validateAddress', () => {
  it('accepts an address picked from the list', () => {
    expect(validateAddress(ADDRESS)).toBeUndefined()
  })

  it('asks to select an address when none is picked', () => {
    expect(validateAddress(null)).toBe('Select your address')
  })

  it('formats an address on one line', () => {
    expect(formatAddress(ADDRESS)).toBe('1226 University Dr, Menlo Park, CA 94025')
  })
})

describe('validateContactShipping', () => {
  it('returns no errors for a complete form', () => {
    expect(
      validateContactShipping({
        email: 'alex@example.com',
        phone: '6502137552',
        fullName: 'Alex Smith',
        address: ADDRESS,
        address2: '',
      }),
    ).toEqual({})
  })

  it('reports every required field on an empty form, in focus order', () => {
    expect(Object.keys(validateContactShipping(EMPTY_CONTACT_SHIPPING))).toEqual([
      'email',
      'phone',
      'fullName',
      'address',
    ])
  })

  it('limits apartment / suite length', () => {
    const errors = validateContactShipping({ ...EMPTY_CONTACT_SHIPPING, address2: 'x'.repeat(51) })
    expect(errors.address2).toBe('Keep it under 50 characters')
  })
})
