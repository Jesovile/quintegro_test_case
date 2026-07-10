import { describe, it, expect, beforeEach } from 'vitest';
import { OrderService } from '../orderService';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository, InMemoryDeliveryMethodRepository } from '../../repositories/implementations';
import { OrderRecord } from '../../types/entities';

describe('OrderService.cancelOrder', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  function markPaid(orderId: string) {
    const order = orderRepository.findById(orderId) as OrderRecord;
    orderRepository.update({ ...order, status: 'paid', paidAt: Date.now() });
  }

  it("cancels a 'paid' order owned by the caller, returning status 'cancelled'", async () => {
    markPaid('order-2');

    const result = await orderService.cancelOrder('order-2', 'user-1');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('cancelled');

    const persisted = orderRepository.findById('order-2')!;
    expect(persisted.status).toBe('cancelled');
    expect(persisted.cancelledAt).toBeTypeOf('number');
  });

  it('returns null when the order is not owned by the caller', async () => {
    markPaid('order-2');
    const result = await orderService.cancelOrder('order-2', 'user-2');
    expect(result).toBeNull();

    // Status must stay unchanged (AC-601-4)
    expect(orderRepository.findById('order-2')!.status).toBe('paid');
  });

  it('returns null when the order does not exist', async () => {
    const result = await orderService.cancelOrder('order-does-not-exist', 'user-1');
    expect(result).toBeNull();
  });

  it("throws 'Order cannot be cancelled in its current status' for a 'created' order", async () => {
    // order-2 is seeded as 'created'
    await expect(orderService.cancelOrder('order-2', 'user-1')).rejects.toThrow(
      'Order cannot be cancelled in its current status'
    );

    // Status must stay unchanged (AC-601-4)
    expect(orderRepository.findById('order-2')!.status).toBe('created');
  });

  it("throws 'Order cannot be cancelled in its current status' when cancelling an already-cancelled order (no double-cancel)", async () => {
    markPaid('order-2');
    const first = await orderService.cancelOrder('order-2', 'user-1');
    expect(first!.status).toBe('cancelled');

    await expect(orderService.cancelOrder('order-2', 'user-1')).rejects.toThrow(
      'Order cannot be cancelled in its current status'
    );
  });
});
