export interface TokenizedPaymentMethod {
  token: string
  brand: string
  last4: string
}

export interface PaymentValidationErrors {
  cardNumber?: string
  cvv?: string
}

export function tokenizeMockPayment(cardNumber: string, cvv: string): TokenizedPaymentMethod {
  const errors = validateMockPaymentDetails(cardNumber, cvv)
  if (errors.cardNumber) throw new Error(errors.cardNumber)
  if (errors.cvv) throw new Error(errors.cvv)

  const digits = cardNumber.replace(/\D/g, '')
  const last4 = digits.slice(-4)
  const brand = digits.startsWith('4') ? 'Visa' : 'Mastercard'
  const outcome = last4 === '0002' ? '_decline' : last4 === '0003' ? '_action' : last4 === '0004' ? '_unavailable' : ''
  return { token: `mock_${brand.toLowerCase()}_${last4}${outcome}`, brand, last4 }
}

export function validateMockPaymentDetails(cardNumber: string, cvv: string): PaymentValidationErrors {
  const digits = cardNumber.replace(/\D/g, '')
  const errors: PaymentValidationErrors = {}

  if (!/^\d{12,19}$/.test(digits) || !isLuhnValid(digits)) errors.cardNumber = 'Enter a valid card number'
  if (!/^\d{3,4}$/.test(cvv)) errors.cvv = 'Enter a valid CVV'

  return errors
}

function isLuhnValid(digits: string): boolean {
  let sum = 0
  let shouldDouble = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index])
    if (shouldDouble) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    shouldDouble = !shouldDouble
  }

  return sum % 10 === 0
}
