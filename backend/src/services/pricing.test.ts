import { describe, expect, it } from 'vitest';
import { calculateOrderTotals } from './pricing';

describe('calculateOrderTotals', () => {
  it('multiplies price by amount in whole dollars', () => {
    const totals = calculateOrderTotals([
      { amount: 2, price: 900 },
      { amount: 1, price: 200 }
    ]);

    expect(totals).toEqual({ subtotal: 2000, discount: 0, total: 2000, currency: 'USD' });
  });

  it('rounds the discount half up to a whole dollar', () => {
    expect(calculateOrderTotals([{ amount: 1, price: 25 }], 10).discount).toBe(3);
    expect(calculateOrderTotals([{ amount: 1, price: 24 }], 10).discount).toBe(2);
  });

  it('keeps the total an integer', () => {
    const totals = calculateOrderTotals([{ amount: 3, price: 199 }], 15);

    expect(Number.isInteger(totals.total)).toBe(true);
    expect(totals.total).toBe(totals.subtotal - totals.discount);
  });

  it('returns zero totals for an empty order', () => {
    expect(calculateOrderTotals([]).total).toBe(0);
  });
});
