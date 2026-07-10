import { describe, it, expect, beforeEach } from 'vitest';
import { OrderService } from '../orderService';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository, InMemoryDeliveryMethodRepository } from '../../repositories/implementations';
import { DeliveryAddress } from '../../types/entities';

describe('OrderService.setDeliveryDetails', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;

  const validAddress: DeliveryAddress = {
    recipientName: 'Jane Doe',
    phone: '+1 555 123 4567',
    country: 'USA',
    city: 'Springfield',
    street: 'Main St',
    building: '12',
    postalCode: '11111'
  };

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  it('writes deliveryAddress and a fee/estimatedDays snapshot copied from the catalog onto a created order owned by the caller', async () => {
    const result = await orderService.setDeliveryDetails('order-2', 'user-1', validAddress, 'extra');

    expect(result).not.toBeNull();
    expect(result!.deliveryAddress).toEqual(validAddress);
    expect(result!.deliveryMethod).toEqual({ type: 'extra', fee: 14.99, estimatedDays: '1-2' });

    // Persisted, not just returned
    const persisted = orderRepository.findById('order-2');
    expect(persisted!.deliveryAddress).toEqual(validAddress);
    expect(persisted!.deliveryMethod).toEqual({ type: 'extra', fee: 14.99, estimatedDays: '1-2' });
  });

  it('returns null when the order is not owned by the caller', async () => {
    const result = await orderService.setDeliveryDetails('order-2', 'user-2', validAddress, 'regular');
    expect(result).toBeNull();
  });

  it('returns null when the order does not exist', async () => {
    const result = await orderService.setDeliveryDetails('order-does-not-exist', 'user-1', validAddress, 'regular');
    expect(result).toBeNull();
  });

  it("returns null when the order's status is not 'created'", async () => {
    // order-1 is seeded with status 'finished'
    const result = await orderService.setDeliveryDetails('order-1', 'user-1', validAddress, 'regular');
    expect(result).toBeNull();
  });
});
