// Money math in integer cents: avoids floating point drift (0.1 + 0.2) and keeps
// "Subtotal - Promo + Delivery = Total" exact to the cent on screen.
export const toCents = (dollars: number): number => Math.round(dollars * 100)
export const fromCents = (cents: number): number => cents / 100
export const formatMoney = (dollars: number): string => `$${dollars.toFixed(2)}`
