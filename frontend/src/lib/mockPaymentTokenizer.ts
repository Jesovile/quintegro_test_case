export interface TokenizedPaymentMethod {
  token: string
  brand: string
  last4: string
}

export function tokenizeMockPayment(cardNumber: string, cvv: string): TokenizedPaymentMethod {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 12 || !/^\d{3,4}$/.test(cvv)) throw new Error('Enter valid card details')

  const last4 = digits.slice(-4)
  const brand = digits.startsWith('4') ? 'Visa' : 'Mastercard'
  const outcome = last4 === '0002' ? '_decline' : last4 === '0003' ? '_action' : last4 === '0004' ? '_unavailable' : ''
  return { token: `mock_${brand.toLowerCase()}_${last4}${outcome}`, brand, last4 }
}
