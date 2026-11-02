export interface CardFormValues {
  cardNumber: string
  expiry: string
  cvc: string
}

export type CardField = keyof CardFormValues

export type CardFormErrors = Partial<Record<CardField, string>>

export const CARD_FIELDS: CardField[] = ['cardNumber', 'expiry', 'cvc']

export const EMPTY_CARD: CardFormValues = { cardNumber: '', expiry: '', cvc: '' }

export const cardDigits = (cardNumber: string): string => cardNumber.replace(/[\s-]/g, '')

export const passesLuhn = (digits: string): boolean => {
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }
  return sum % 10 === 0
}

const EXPIRY_PATTERN = /^(0[1-9]|1[0-2])\/(\d{2})$/

// A card is valid through the last day of its expiry month
export const isExpiryInFuture = (expiry: string, now = new Date()): boolean => {
  const match = EXPIRY_PATTERN.exec(expiry.trim())
  if (!match) {
    return false
  }
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)
}

export const validateCardForm = (values: CardFormValues, now = new Date()): CardFormErrors => {
  const digits = cardDigits(values.cardNumber)
  const errors: CardFormErrors = {}

  if (!/^\d{13,19}$/.test(digits) || !passesLuhn(digits)) {
    errors.cardNumber = 'Enter a valid card number'
  }
  if (!EXPIRY_PATTERN.test(values.expiry.trim())) {
    errors.expiry = 'Enter the expiry date as MM/YY'
  } else if (!isExpiryInFuture(values.expiry, now)) {
    errors.expiry = 'This card has expired'
  }
  if (!/^\d{3,4}$/.test(values.cvc.trim())) {
    errors.cvc = 'Enter the 3 or 4 digit security code'
  }
  return errors
}
