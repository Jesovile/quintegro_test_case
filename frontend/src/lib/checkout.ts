export interface CustomerForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  state: string
  address: string
  zipcode: string
}

export interface CardForm {
  cardholderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  securityCode: string
}

export type CheckoutField = keyof CustomerForm | keyof CardForm
export type CheckoutErrors = Partial<Record<CheckoutField, string>>

export const emptyCustomer: CustomerForm = {
  firstName: '', lastName: '', email: '', phone: '', state: '', address: '', zipcode: ''
}
export const emptyCard: CardForm = {
  cardholderName: '', number: '', expiryMonth: '', expiryYear: '', securityCode: ''
}

export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

export function buildCheckoutInput(customer: CustomerForm, card: CardForm) {
  return {
    customer: {
      firstName: customer.firstName.trim(),
      lastName: customer.lastName.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      address: `${customer.address.trim()}, ${customer.state.trim()}`,
      zipcode: customer.zipcode.trim()
    },
    creditCard: {
      cardholderName: card.cardholderName.trim(),
      number: card.number.replace(/[ -]/g, ''),
      expiryMonth: Number(card.expiryMonth),
      expiryYear: Number(card.expiryYear),
      securityCode: card.securityCode.trim()
    }
  }
}

export function validateCheckoutForm(customer: CustomerForm, card: CardForm, now = new Date()): CheckoutErrors {
  const errors: CheckoutErrors = {}
  const required: [CheckoutField, string, number][] = [
    ['firstName', customer.firstName, 100], ['lastName', customer.lastName, 100],
    ['email', customer.email, 254], ['phone', customer.phone, 40],
    ['state', customer.state, 100], ['address', customer.address, 1000],
    ['zipcode', customer.zipcode, 10], ['cardholderName', card.cardholderName, 100],
    ['number', card.number, 40], ['expiryMonth', card.expiryMonth, 2],
    ['expiryYear', card.expiryYear, 4], ['securityCode', card.securityCode, 4]
  ]
  for (const [field, value, limit] of required) {
    if (!value.trim()) errors[field] = 'This field is required.'
    else if (value.trim().length > limit) errors[field] = `Use at most ${limit} characters.`
  }
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (customer.phone && (!/^\+?[\d\s().-]+$/.test(customer.phone.trim())
    || !/^\d{7,15}$/.test(customer.phone.replace(/\D/g, '')))) {
    errors.phone = 'Enter a phone number with 7 to 15 digits.'
  }
  if (customer.zipcode && !/^\d{5}(-\d{4})?$/.test(customer.zipcode.trim())) {
    errors.zipcode = 'Use a 5-digit ZIP code or ZIP+4 (12345-6789).'
  }
  if (`${customer.address.trim()}, ${customer.state.trim()}`.length > 1000) {
    errors.address = 'Address and state together must be at most 1,000 characters.'
  }
  const number = card.number.replace(/[ -]/g, '')
  if (card.number) {
    let sum = 0
    for (let index = number.length - 1; index >= 0; index--) {
      let digit = Number(number[index])
      if ((number.length - 1 - index) % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
      sum += digit
    }
    if (!/^\d{13,19}$/.test(number) || /^0+$/.test(number) || sum % 10 !== 0) {
      errors.number = 'Enter a valid card number.'
    }
  }
  const month = Number(card.expiryMonth)
  const year = Number(card.expiryYear)
  if (card.expiryMonth && (!/^\d{1,2}$/.test(card.expiryMonth) || month < 1 || month > 12)) {
    errors.expiryMonth = 'Use a month from 01 to 12.'
  }
  if (card.expiryYear && (!/^\d{4}$/.test(card.expiryYear) || year < now.getUTCFullYear())) {
    errors.expiryYear = 'Enter a valid four-digit year.'
  } else if (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1) {
    errors.expiryMonth = 'This card has expired.'
  }
  if (card.securityCode && !/^\d{3,4}$/.test(card.securityCode.trim())) {
    errors.securityCode = 'Enter the 3 or 4 digits on your card.'
  }
  return errors
}

export function paymentErrorMessage(code: string): string {
  switch (code) {
    case 'PAYMENT_DECLINED': return 'Your payment was declined. Check your card details or try another card.'
    case 'PAYMENT_PROVIDER_ERROR': return 'The payment service is unavailable. Please try again.'
    case 'ORDER_PROCESSING': return 'A payment for this order is already in progress. Please wait and reload the order before trying again.'
    case 'AUTHENTICATION_REQUIRED': return 'Your session has expired. Please sign in again to continue.'
    case 'ORDER_NOT_FOUND': return 'This order is unavailable or you do not have access to it.'
    case 'INVALID_ORDER_STATUS': return 'This order can no longer be checked out. Return to your orders to check its status.'
    case 'INVALID_ORDER_TOTAL': return 'This order does not have a valid total. Return to your orders to review it.'
    case 'VALIDATION_ERROR': return 'Please check your contact, address, and card details before trying again.'
    default: return 'We could not confirm your payment. Please try again. An approved payment will not be charged again.'
  }
}
