const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})

// Amounts are whole US dollars
export const formatUsd = (amount: number): string => usdFormatter.format(amount)
