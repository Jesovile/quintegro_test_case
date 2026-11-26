// Client-side payment card checks: brand detection by IIN prefix, length per
// brand, Luhn (mod 10) checksum, expiry date and security code length.
// These catch typos before the request; the payment processor still has the
// final word on whether a card is real and can be charged.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover'

interface BrandSpec {
  label: string
  lengths: number[]
  cvcLength: number
  /** Positions where a space is inserted while formatting. */
  gaps: number[]
}

export const CARD_BRANDS: Record<CardBrand, BrandSpec> = {
  visa: { label: 'Visa', lengths: [13, 16, 19], cvcLength: 3, gaps: [4, 8, 12] },
  mastercard: { label: 'Mastercard', lengths: [16], cvcLength: 3, gaps: [4, 8, 12] },
  amex: { label: 'American Express', lengths: [15], cvcLength: 4, gaps: [4, 10] },
  discover: { label: 'Discover', lengths: [16, 17, 18, 19], cvcLength: 3, gaps: [4, 8, 12] },
}

const MAX_CARD_DIGITS = 19

const inRange = (digits: string, size: number, from: number, to: number) => {
  if (digits.length < size) return false
  const n = Number(digits.slice(0, size))
  return n >= from && n <= to
}

/** Detects the brand from the issuer identification number (leading digits). */
export function detectCardBrand(digits: string): CardBrand | null {
  if (/^4/.test(digits)) return 'visa'
  if (/^3[47]/.test(digits)) return 'amex'
  if (inRange(digits, 2, 51, 55) || inRange(digits, 4, 2221, 2720)) return 'mastercard'
  if (/^6011/.test(digits) || /^65/.test(digits) || inRange(digits, 3, 644, 649)) return 'discover'
  return null
}

export const normalizeCardNumber = (input: string) => input.replace(/\D/g, '').slice(0, MAX_CARD_DIGITS)

export function formatCardNumber(digits: string): string {
  const brand = detectCardBrand(digits)
  const gaps = brand ? CARD_BRANDS[brand].gaps : [4, 8, 12, 16]
  const maxLength = brand ? Math.max(...CARD_BRANDS[brand].lengths) : MAX_CARD_DIGITS
  let out = ''
  digits
    .slice(0, maxLength)
    .split('')
    .forEach((d, i) => {
      if (gaps.includes(i)) out += ' '
      out += d
    })
  return out
}

/** Luhn / mod 10 checksum used by all major card networks. */
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function validateCardNumber(digits: string): string | undefined {
  if (!digits) return 'Enter your card number'
  const brand = detectCardBrand(digits)
  if (!brand) return 'We accept Visa, Mastercard, American Express and Discover'
  if (!CARD_BRANDS[brand].lengths.includes(digits.length)) return 'Your card number is incomplete'
  if (!passesLuhn(digits)) return 'Check your card number'
  return undefined
}

/* --------------------------------- Expiry ---------------------------------- */

/**
 * "MM / YY" while typing. Accepts autofill formats like "12/2030" or "1230".
 * A first digit 2-9 can only be a month, so it becomes "0X".
 */
export function formatExpiry(input: string): string {
  let digits = input.replace(/\D/g, '')
  // "MM/YYYY" from autofill -> MMYY
  if (digits.length === 6 && /^20/.test(digits.slice(2))) digits = digits.slice(0, 2) + digits.slice(4)
  if (/^[2-9]/.test(digits)) digits = `0${digits}`
  digits = digits.slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}

const MAX_YEARS_AHEAD = 20

export function validateExpiry(value: string, now: Date = new Date()): string | undefined {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Enter the expiration date'
  if (digits.length !== 4) return 'Enter the date as MM / YY'

  const month = Number(digits.slice(0, 2))
  const year = 2000 + Number(digits.slice(2))
  if (month < 1 || month > 12) return 'Enter a valid month'

  // A card is valid through the last day of its expiry month.
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  if (year < currentYear || (year === currentYear && month < currentMonth)) return 'Your card has expired'
  if (year > currentYear + MAX_YEARS_AHEAD) return 'Check the expiration year'
  return undefined
}

/* ---------------------------------- CVC ------------------------------------ */

export const cvcLengthFor = (cardDigits: string) => {
  const brand = detectCardBrand(cardDigits)
  return brand ? CARD_BRANDS[brand].cvcLength : 3
}

export function validateCvc(cvc: string, cardDigits: string): string | undefined {
  const length = cvcLengthFor(cardDigits)
  if (!cvc) return 'Enter the security code'
  if (!new RegExp(`^\\d{${length}}$`).test(cvc)) return `Enter the ${length}-digit security code`
  return undefined
}

/* ------------------------------ Name on card ------------------------------- */

const CARD_NAME_RE = /^\p{L}[\p{L}\p{M}' .-]*$/u

export function validateCardName(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return 'Enter the name on your card'
  if (value.length < 2) return 'Name must be at least 2 characters'
  if (value.length > 100 || !CARD_NAME_RE.test(value)) return 'Enter the name as it appears on your card'
  return undefined
}

/* ---------------------------------- Form ----------------------------------- */

export interface CardForm {
  number: string // digits only
  expiry: string // "MM / YY"
  cvc: string // digits only
  name: string
}

export const EMPTY_CARD: CardForm = { number: '', expiry: '', cvc: '', name: '' }

export type CardField = keyof CardForm
export const CARD_FIELD_ORDER: CardField[] = ['number', 'expiry', 'cvc', 'name']

export function validateCard(card: CardForm, now: Date = new Date()): Partial<Record<CardField, string>> {
  const errors: Partial<Record<CardField, string>> = {
    number: validateCardNumber(card.number),
    expiry: validateExpiry(card.expiry, now),
    cvc: validateCvc(card.cvc, card.number),
    name: validateCardName(card.name),
  }
  for (const key of CARD_FIELD_ORDER) if (!errors[key]) delete errors[key]
  return errors
}
