import { beforeEach, describe, expect, it } from 'vitest';
import { Request } from 'express';
import { createContainer, Container } from '../container';
import { createApolloServer } from './server';

const UPDATE_AMOUNT = `mutation Update($orderId: ID!, $productId: ID!, $amount: Int!) {
  updateProductAmount(orderId: $orderId, productId: $productId, amount: $amount) { products { amount } totals { total } }
}`;
const DELETE_PRODUCT = `mutation Delete($orderId: ID!, $productId: ID!) {
  deleteProductFromOrder(orderId: $orderId, productId: $productId) { products { product { id } } totals { total } }
}`;

describe('editing order composition', () => {
  let container: Container;
  let server: ReturnType<typeof createApolloServer>;
  let context: { req: Request };

  beforeEach(async () => {
    container = createContainer();
    server = createApolloServer(container.orderService, container.authService, container.promoService);
    const token = await container.authService.authenticateUser('john.doe', 'password123');
    context = { req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request };
  });

  it('saves the amount on the server and recalculates totals', async () => {
    const result = await server.executeOperation(
      { query: UPDATE_AMOUNT, variables: { orderId: 'order-2', productId: 'product-1', amount: 3 } },
      context
    );

    expect(result.errors).toBeUndefined();
    expect(container.orderRepository.findById('order-2')?.products[0].amount).toBe(3);
    expect((result.data?.updateProductAmount as { totals: { total: number } }).totals.total).toBe(30000 + 2600);
  });

  it('clamps the amount to 1..10', async () => {
    await server.executeOperation(
      { query: UPDATE_AMOUNT, variables: { orderId: 'order-2', productId: 'product-1', amount: 50 } },
      context
    );

    expect(container.orderRepository.findById('order-2')?.products[0].amount).toBe(10);
  });

  it.each(['order-1', 'order-3'])('refuses to change %s after it left created', async (orderId) => {
    const before = container.orderRepository.findById(orderId);
    const productId = before?.products[0].id;

    const update = await server.executeOperation({ query: UPDATE_AMOUNT, variables: { orderId, productId, amount: 2 } }, context);
    const remove = await server.executeOperation({ query: DELETE_PRODUCT, variables: { orderId, productId } }, context);

    expect(update.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
    expect(remove.errors?.[0].extensions?.code).toBe('ORDER_NOT_EDITABLE');
    expect(container.orderRepository.findById(orderId)).toEqual(before);
  });

  it('leaves an empty order after removing the last position', async () => {
    const order = container.orderRepository.findById('order-2');
    container.orderRepository.update({ ...order!, products: [order!.products[0]] });

    const result = await server.executeOperation(
      { query: DELETE_PRODUCT, variables: { orderId: 'order-2', productId: 'product-1' } },
      context
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteProductFromOrder).toEqual({ products: [], totals: { total: 0 } });
  });

  it('keeps the list working when a product left the catalog', async () => {
    const order = container.orderRepository.findById('order-2');
    container.orderRepository.update({ ...order!, products: [{ id: 'gone', amount: 2, price: 100 }] });

    const orders = await container.orderService.getOrdersByUserId('user-1');
    const updated = orders.find(item => item.orderId === 'order-2');

    expect(updated?.products[0].product.title).toBe('Unavailable product');
    expect(updated?.totals.total).toBe(200);
  });

  it('does not let another user change the order', async () => {
    const token = await container.authService.authenticateUser('jane.smith', 'password456');
    const janeContext = { req: { headers: { authorization: `Bearer ${token}` } } as unknown as Request };

    const result = await server.executeOperation(
      { query: UPDATE_AMOUNT, variables: { orderId: 'order-2', productId: 'product-1', amount: 3 } },
      janeContext
    );

    expect(result.errors?.[0].extensions?.code).toBe('ORDER_NOT_FOUND');
  });
});
