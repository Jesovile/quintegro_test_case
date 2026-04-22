import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository
} from '../../src/repositories/implementations';
import { OrderService, LastProductError } from '../../src/services/orderService';
import { PaymentProvider, ChargeRequest, ChargeResult } from '../../src/services/paymentProvider';
import { ShippingInfo } from '../../src/types/entities';

const VALID_SHIPPING: ShippingInfo = {
  fullName: 'Jane Doe',
  address: '1 Main St',
  city: 'Springfield',
  zip: '12345',
  country: 'US',
  phone: '+1 555 0100'
};

const VALID_CARD: ChargeRequest['card'] = {
  number: '4242424242424242',
  holderName: 'Jane Doe',
  expiryMonth: 12,
  expiryYear: 2030,
  cvv: '123'
};

class StubPayment implements PaymentProvider {
  public calls = 0;
  constructor(private result: ChargeResult) {}
  async charge(_req: ChargeRequest): Promise<ChargeResult> {
    this.calls++;
    return this.result;
  }
}

function buildService(paymentResult: ChargeResult = { ok: true, transactionId: 'tx_1' }) {
  const orderRepo = new InMemoryOrderRepository();
  const productRepo = new InMemoryProductRepository();
  const promoRepo = new InMemoryPromoRepository();
  const payment = new StubPayment(paymentResult);
  const service = new OrderService(orderRepo, productRepo, promoRepo, payment);
  return { service, orderRepo, payment };
}

describe('OrderService.getOrdersByUserId', () => {
  it('returns only orders owned by user', async () => {
    const { service } = buildService();
    const orders = await service.getOrdersByUserId('user-1');
    expect(orders.length).toBe(2);
    expect(orders.every(o => typeof o.orderId === 'string')).toBe(true);
  });

  it('returns empty list for unknown user', async () => {
    const { service } = buildService();
    const orders = await service.getOrdersByUserId('ghost');
    expect(orders).toEqual([]);
  });
});

describe('OrderService.getOrderById', () => {
  it('returns null when order is owned by another user', async () => {
    const { service } = buildService();
    const order = await service.getOrderById('order-1', 'user-2');
    expect(order).toBeNull();
  });

  it('returns null when order does not exist', async () => {
    const { service } = buildService();
    const order = await service.getOrderById('order-404', 'user-1');
    expect(order).toBeNull();
  });
});

describe('OrderService.calculateOrderSum', () => {
  it('sums products without promo', () => {
    const { service } = buildService();
    const sum = service.calculateOrderSum([
      { id: 'product-1', amount: 2, price: 100 },
      { id: 'product-2', amount: 1, price: 50 }
    ]);
    expect(sum).toBe(250);
  });

  it('applies valid promo discount', () => {
    const { service } = buildService();
    const sum = service.calculateOrderSum([{ id: 'p', amount: 1, price: 100 }], 'SAVE10');
    expect(sum).toBe(90);
  });

  it('ignores expired promo', () => {
    const { service } = buildService();
    const sum = service.calculateOrderSum([{ id: 'p', amount: 1, price: 100 }], 'SAVE5');
    expect(sum).toBe(100);
  });

  it('ignores unknown promo', () => {
    const { service } = buildService();
    const sum = service.calculateOrderSum([{ id: 'p', amount: 1, price: 100 }], 'NOPE');
    expect(sum).toBe(100);
  });
});

describe('OrderService.deleteProductFromOrder', () => {
  it('removes a product and returns updated order', async () => {
    const { service } = buildService();
    const result = await service.deleteProductFromOrder('order-2', 'product-2', 'user-1');
    expect(result).not.toBeNull();
    expect(result!.products.some(p => p.product.id === 'product-2')).toBe(false);
  });

  it('returns null when order not owned by user', async () => {
    const { service } = buildService();
    const result = await service.deleteProductFromOrder('order-2', 'product-2', 'user-2');
    expect(result).toBeNull();
  });

  it('returns null when product is not in order', async () => {
    const { service } = buildService();
    const result = await service.deleteProductFromOrder('order-2', 'ghost-product', 'user-1');
    expect(result).toBeNull();
  });

  it('throws LastProductError when removing the final product', async () => {
    const { service, orderRepo } = buildService();
    // Reduce order-2 down to one product
    const order = orderRepo.findById('order-2')!;
    orderRepo.update({ ...order, products: [order.products[0]] });
    await expect(
      service.deleteProductFromOrder('order-2', order.products[0].id, 'user-1')
    ).rejects.toBeInstanceOf(LastProductError);
  });
});

describe('OrderService.startCheckout', () => {
  it('flips created -> checkout', async () => {
    const { service } = buildService();
    const result = await service.startCheckout('order-2', 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe('checkout');
  });

  it('is idempotent when already in checkout', async () => {
    const { service } = buildService();
    await service.startCheckout('order-2', 'user-1');
    const result = await service.startCheckout('order-2', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('rejects when order already finished', async () => {
    const { service } = buildService();
    const result = await service.startCheckout('order-1', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_STATUS');
  });

  it('rejects for non-owner', async () => {
    const { service } = buildService();
    const result = await service.startCheckout('order-2', 'user-2');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('FORBIDDEN');
  });

  it('returns ORDER_NOT_FOUND for unknown order', async () => {
    const { service } = buildService();
    const result = await service.startCheckout('order-404', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('ORDER_NOT_FOUND');
  });
});

describe('OrderService.updateCheckout', () => {
  it('requires checkout state', async () => {
    const { service } = buildService();
    const result = await service.updateCheckout('order-2', 'user-1', { shipping: VALID_SHIPPING });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_STATUS');
  });

  it('rejects invalid shipping', async () => {
    const { service } = buildService();
    await service.startCheckout('order-2', 'user-1');
    const result = await service.updateCheckout('order-2', 'user-1', {
      shipping: { ...VALID_SHIPPING, city: '' }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_SHIPPING');
  });

  it('persists valid shipping', async () => {
    const { service } = buildService();
    await service.startCheckout('order-2', 'user-1');
    const result = await service.updateCheckout('order-2', 'user-1', { shipping: VALID_SHIPPING });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.shipping).toEqual(VALID_SHIPPING);
  });
});

describe('OrderService.cancelCheckout', () => {
  it('moves checkout -> canceled with timestamp', async () => {
    const { service } = buildService();
    await service.startCheckout('order-2', 'user-1');
    const result = await service.cancelCheckout('order-2', 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.status).toBe('canceled');
      expect(typeof result.order.canceledAt).toBe('number');
    }
  });

  it('can cancel straight from created', async () => {
    const { service } = buildService();
    const result = await service.cancelCheckout('order-2', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('refuses to cancel finished order', async () => {
    const { service } = buildService();
    const result = await service.cancelCheckout('order-1', 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_STATUS');
  });
});

describe('OrderService.placeOrder', () => {
  it('charges and marks order submited', async () => {
    const { service, payment } = buildService();
    await service.startCheckout('order-2', 'user-1');
    await service.updateCheckout('order-2', 'user-1', { shipping: VALID_SHIPPING });
    const result = await service.placeOrder('order-2', 'user-1', VALID_CARD);
    expect(result.ok).toBe(true);
    expect(payment.calls).toBe(1);
    if (result.ok) {
      expect(result.order.status).toBe('submited');
      expect(result.order.placedAt).toBeDefined();
      expect(result.order.payment?.last4).toBe('4242');
    }
  });

  it('does not charge when shipping is missing', async () => {
    const { service, payment } = buildService();
    await service.startCheckout('order-2', 'user-1');
    const result = await service.placeOrder('order-2', 'user-1', VALID_CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('MISSING_SHIPPING');
    expect(payment.calls).toBe(0);
  });

  it('surfaces PAYMENT_FAILED when provider declines', async () => {
    const { service } = buildService({ ok: false, error: 'Card declined' });
    await service.startCheckout('order-2', 'user-1');
    await service.updateCheckout('order-2', 'user-1', { shipping: VALID_SHIPPING });
    const result = await service.placeOrder('order-2', 'user-1', VALID_CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('PAYMENT_FAILED');
      expect(result.message).toBe('Card declined');
    }
  });

  it('requires checkout status', async () => {
    const { service } = buildService();
    const result = await service.placeOrder('order-2', 'user-1', VALID_CARD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('INVALID_STATUS');
  });

  it('stores redacted payment and never the full PAN', async () => {
    const { service, orderRepo } = buildService();
    await service.startCheckout('order-2', 'user-1');
    await service.updateCheckout('order-2', 'user-1', { shipping: VALID_SHIPPING });
    await service.placeOrder('order-2', 'user-1', VALID_CARD);
    const stored = orderRepo.findById('order-2')!;
    expect(stored.payment).toBeDefined();
    expect(stored.payment!.last4).toBe('4242');
    expect(JSON.stringify(stored)).not.toContain(VALID_CARD.number);
  });
});
