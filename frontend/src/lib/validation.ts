// Client-side validation for the checkout "Contact & Shipping" form.
// All checks run in the browser; the backend does not validate these fields.

/** A shipping address as returned by the backend `searchAddresses` query. */
export interface Address {
  id: string
  line1: string
  city: string
  /** Two-letter USPS state code, e.g. "CA". */
  state: string
  zip: string
}

export interface ContactShipping {
  email: string
  /** National number only: 10 digits, no +1, no formatting. */
  phone: string
  /** First and last name in a single field. */
  fullName: string
  /** Must be picked from the address select. */
  address: Address | null
  /** Apartment, suite, unit... Optional free text. */
  address2: string
}

export type ContactShippingField = 'email' | 'phone' | 'fullName' | 'address' | 'address2'
export type FieldErrors = Partial<Record<ContactShippingField, string>>

export const EMPTY_CONTACT_SHIPPING: ContactShipping = {
  email: '',
  phone: '',
  fullName: '',
  address: null,
  address2: '',
}

export const formatAddress = (a: Address) => `${a.line1}, ${a.city}, ${a.state} ${a.zip}`

/* ---------------------------------- Email --------------------------------- */

// Based on the WHATWG HTML "valid e-mail address" grammar, tightened to require
// a dot-separated domain with an alphabetic TLD of 2+ letters (name@host is
// valid per WHATWG but never a deliverable shop customer address).
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

export function validateEmail(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return 'Enter your email address'

  const local = value.slice(0, value.lastIndexOf('@'))
  // RFC 5321 size limits: local part <= 64 octets, whole address <= 254.
  const tooLong = value.length > 254 || local.length > 64
  // Dot-atom local part: no leading, trailing or consecutive dots.
  const badDots = local.startsWith('.') || local.endsWith('.') || local.includes('..')

  if (!EMAIL_RE.test(value) || tooLong || badDots) {
    return 'Enter a valid email, like name@example.com'
  }
  return undefined
}

/* ------------------------------- US phone ---------------------------------- */

/**
 * Reduces any user input (typed, pasted, autofilled) to at most 10 national
 * digits. A leading country code "1" is dropped: the +1 is shown as a fixed
 * prefix, and no NANP area code starts with 1.
 */
export function normalizeUsPhone(input: string): string {
  return input.replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
}

/** Progressive "(650) 213-7552" formatting that keeps backspace natural. */
export function formatUsPhone(digits: string): string {
  const d = digits.slice(0, 10)
  if (d.length === 0) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// NANP numbering plan: NXX-NXX-XXXX where N is 2-9.
// N11 codes (211, 411, 911...) are service codes, never area codes or exchanges.
// N9X area codes are reserved for future expansion of the plan.
const isN11 = (code: string) => code[1] === '1' && code[2] === '1'

export function validateUsPhone(digits: string): string | undefined {
  if (!digits) return 'Enter your phone number'
  if (!/^\d{10}$/.test(digits)) return 'Enter a 10-digit US phone number'

  const area = digits.slice(0, 3)
  const exchange = digits.slice(3, 6)

  if (!/^[2-9]/.test(area) || isN11(area) || area[1] === '9') {
    return `${area} isn't a valid US area code`
  }
  if (!/^[2-9]/.test(exchange) || isN11(exchange)) {
    return 'Enter a valid US phone number'
  }
  return undefined
}

/** E.164 representation for sending to an API, e.g. "+16502137552". */
export const toE164 = (digits: string) => `+1${digits}`

/* -------------------------------- Full name -------------------------------- */

export const FULL_NAME_MIN = 2
export const FULL_NAME_MAX = 100
// Letters (any script), combining marks, spaces, apostrophes, periods, hyphens.
const NAME_RE = /^\p{L}[\p{L}\p{M}' .-]*$/u

export function validateFullName(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return 'Enter your full name'
  if (value.length < FULL_NAME_MIN) return `Name must be at least ${FULL_NAME_MIN} characters`
  if (value.length > FULL_NAME_MAX || !NAME_RE.test(value)) return 'Enter a valid name'
  return undefined
}

/* --------------------------------- Address --------------------------------- */

export function validateAddress(address: Address | null): string | undefined {
  return address ? undefined : 'Select your address'
}

/* ---------------------------------- Form ----------------------------------- */

/** Field order matters: the first invalid field gets focus on submit. */
export const FIELD_ORDER: ContactShippingField[] = ['email', 'phone', 'fullName', 'address', 'address2']

export function validateContactShipping(form: ContactShipping): FieldErrors {
  const errors: FieldErrors = {
    email: validateEmail(form.email),
    phone: validateUsPhone(form.phone),
    fullName: validateFullName(form.fullName),
    address: validateAddress(form.address),
    address2: form.address2.length > 50 ? 'Keep it under 50 characters' : undefined,
  }
  for (const key of FIELD_ORDER) if (!errors[key]) delete errors[key]
  return errors
}
