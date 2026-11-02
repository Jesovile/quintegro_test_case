import { OrderTotals } from '../types/entities';

// All amounts are whole US dollars
export const calculateOrderTotals = (
  items: Array<{ amount: number; price: number }>,
  discountPercent = 0
): OrderTotals => {
  const subtotal = items.reduce((total, item) => total + item.amount * item.price, 0);
  // A broken promo must never make the total negative or larger than the subtotal
  const percent = Number.isFinite(discountPercent) ? Math.min(100, Math.max(0, discountPercent)) : 0;
  const discount = Math.round((subtotal * percent) / 100);

  return { subtotal, discount, total: subtotal - discount, currency: 'USD' };
};
