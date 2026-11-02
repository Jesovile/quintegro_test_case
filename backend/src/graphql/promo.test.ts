import { beforeEach, describe, expect, it } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';
import { calculateOrderTotals } from '../services/pricing';

const APPLY = `mutation Apply($orderId: ID!, $code: String!) {
  applyPromo(orderId: $orderId, code: $code) { promo { id discount } totals { subtotal discount total } }
}`;
const REMOVE = `mutation Remove($orderId: ID!) {
  removePromo(orderId: $orderId) { promo { id } totals { subtotal discount total } }
}`;

describe('promo code in checkout', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let context: { req: Request };

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container);
    const token = await container.authService.authenticateUser('john.doe', 'password123');
    context = { req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request };
    await server.executeOperation({ query: `mutation { startCheckout(orderId: "order-2") { status } }` }, context);
  });

  const apply = (code: string, orderId = 'order-2') =>
    server.executeOperation({ query: APPLY, variables: { orderId, code } }, context);
  const remove = (orderId = 'order-2') => server.executeOperation({ query: REMOVE, variables: { orderId } }, context);

  it('applies a valid promo, keeps it on the order and discounts the total (AC-3.8)', async () => {
    const result = await apply('SAVE10');

    expect(result.errors).toBeUndefined();
    expect(result.data?.applyPromo).toEqual({
      promo: { id: 'SAVE10', discount: 10 },
      totals: { subtotal: 30000, discount: 3000, total: 27000 }
    });
    expect(container.orderRepository.findById('order-2')?.promo?.id).toBe('SAVE10');
  });

  it('replaces the promo and removes it again (AC-3.8)', async () => {
    await apply('SAVE10');
    const replaced = await apply('SAVE20');
    const removed = await remove();

    expect((replaced.data?.applyPromo as { totals: { total: number } }).totals.total).toBe(24000);
    expect(removed.data?.removePromo).toEqual({ promo: null, totals: { subtotal: 30000, discount: 0, total: 30000 } });
  });

  it.each([
    ['NOPE', 'PROMO_NOT_FOUND'],
    ['save10', 'PROMO_NOT_FOUND'],
    ['SAVE5', 'PROMO_EXPIRED']
  ])('rejects %s with %s and keeps the total (AC-3.9)', async (code, errorCode) => {
    const result = await apply(code);

    expect(result.errors?.[0].extensions?.code).toBe(errorCode);
    expect(container.orderRepository.findById('order-2')?.promo).toBeUndefined();
  });

  it('accepts a code with surrounding spaces', async () => {
    expect((await apply('  SAVE10 ')).errors).toBeUndefined();
  });

  it('allows promo changes only in checkout', async () => {
    const result = await apply('SAVE10', 'order-3');

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
  });

  it('stops discounting once the applied promo expires', async () => {
    await apply('SAVE10');
    const order = container.orderRepository.findById('order-2')!;
    container.orderRepository.update({ ...order, promo: { ...order.promo!, dueDate: Date.now() - 1000 } });

    const dto = container.orderService.toDTO(container.orderRepository.findById('order-2')!);

    expect(dto.promo?.id).toBe('SAVE10');
    expect(dto.promoActive).toBe(false);
    expect(dto.totals.discount).toBe(0);
  });

  it('reports an active promo even when its discount rounds to zero', async () => {
    await apply('SAVE10');
    const order = container.orderRepository.findById('order-2')!;
    container.orderRepository.update({ ...order, products: [{ id: 'product-1', amount: 1, price: 4 }] });

    const dto = container.orderService.toDTO(container.orderRepository.findById('order-2')!);

    expect(dto.promoActive).toBe(true);
    expect(dto.totals.discount).toBe(0);
  });

  it('stores a copy of the promo, not the catalog entry', async () => {
    await apply('SAVE10');
    const catalogEntry = container.promoService.getActivePromo('SAVE10');

    expect(container.orderRepository.findById('order-2')?.promo).not.toBe(catalogEntry);
    expect(container.orderRepository.findById('order-2')?.promo).toEqual(catalogEntry);
  });

  it('hides other users orders', async () => {
    const token = await container.authService.authenticateUser('jane.smith', 'password456');
    const jane = { req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request };

    const result = await server.executeOperation({ query: APPLY, variables: { orderId: 'order-2', code: 'SAVE10' } }, jane);

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
  });
});

describe('discount bounds', () => {
  it('never discounts below zero or above the subtotal', () => {
    expect(calculateOrderTotals([{ amount: 1, price: 100 }], 150).total).toBe(0);
    expect(calculateOrderTotals([{ amount: 1, price: 100 }], -20).total).toBe(100);
  });

  it('ignores a broken discount value', () => {
    expect(calculateOrderTotals([{ amount: 1, price: 100 }], Number.NaN).total).toBe(100);
  });
});
