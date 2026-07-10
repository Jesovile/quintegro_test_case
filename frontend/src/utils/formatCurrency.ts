// Shared currency formatting convention, matching the existing OrderSum
// component (`` `$${value.toFixed(2)}` ``). Introduced by feature 3 so it
// isn't reimplemented in every checkout screen that displays a monetary
// value (review, payment, confirmation/history).
export const formatCurrency = (value: number): string => `$${value.toFixed(2)}`
