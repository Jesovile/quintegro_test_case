import { OrderTotals } from '../types/entities';

// All amounts are whole US dollars
export const calculateOrderTotals = (
  items: Array<{ amount: number; price: number }>,
  discountPercent = 0
): OrderTotals => {
  const subtotal = items.reduce((total, item) => total + item.amount * item.price, 0);
  const discount = Math.round((subtotal * discountPercent) / 100);

  return { subtotal, discount, total: subtotal - discount, currency: 'USD' };
};
