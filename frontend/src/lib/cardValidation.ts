// Pure, client-side format validators for the card payment form. No network
// calls, no persistence — only used to gate the "Pay" button before the
// mocked payOrder mutation is called. Full card-network validation (Luhn,
// BIN checks) is out of scope since payment is mocked end-to-end.

/**
 * Digits-only check with a plausible card-number length. Does not run a
 * Luhn check — basic format validation only, as required by the NFR.
 */
export const isValidCardNumber = (cardNumber: string): boolean => {
  const digitsOnly = cardNumber.replace(/\s+/g, '')
  return /^\d{12,19}$/.test(digitsOnly)
}

/**
 * Expects MM/YY (or MM/YYYY) and checks the expiry is not in the past
 * (comparing to the end of the stated month).
 */
export const isValidExpiry = (expiry: string): boolean => {
  const match = /^(\d{2})\/(\d{2}|\d{4})$/.exec(expiry.trim())
  if (!match) return false

  const month = parseInt(match[1], 10)
  if (month < 1 || month > 12) return false

  let year = parseInt(match[2], 10)
  if (match[2].length === 2) year += 2000

  const now = new Date()
  const expiryEnd = new Date(year, month, 0, 23, 59, 59)
  return expiryEnd.getTime() >= now.getTime()
}

/** 3 or 4 digit CVC. */
export const isValidCvc = (cvc: string): boolean => {
  return /^\d{3,4}$/.test(cvc.trim())
}

export const isValidCardholderName = (name: string): boolean => {
  return name.trim().length > 0
}
