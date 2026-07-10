import { describe, it, expect, beforeEach } from 'vitest';
import { OrderService } from '../orderService';
import { PaymentService } from '../paymentService';
import {
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  InMemoryDeliveryMethodRepository,
  InMemoryPaymentRepository
} from '../../repositories/implementations';
import { OrderStatus } from '../../types/entities';

describe('OrderService.calculateOrderTotal', () => {
  let orderService: OrderService;

  beforeEach(() => {
    const orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  it('returns 0 for an empty products array, no promo, no delivery fee', () => {
    expect(orderService.calculateOrderTotal([], undefined, 0)).toBe(0);
  });

  it('returns subtotal + delivery fee when no promo is applied', () => {
    const products = [
      { id: 'product-2', amount: 1, price: 899.99 },
      { id: 'product-4', amount: 1, price: 599.99 }
    ];
    const subtotal = 899.99 + 599.99;
    expect(orderService.calculateOrderTotal(products, undefined, 5.99)).toBeCloseTo(subtotal + 5.99);
  });

  it('applies a valid, non-expired promo discount before adding the delivery fee', () => {
    const products = [{ id: 'product-2', amount: 1, price: 100 }];
    // SAVE10 = 10% discount, not expired (seeded in InMemoryPromoRepository)
    const expected = (100 - 100 * 0.1) + 5.99;
    expect(orderService.calculateOrderTotal(products, 'SAVE10', 5.99)).toBeCloseTo(expected);
  });

  it('ignores an expired promo, same as calculateOrderSum, and still adds the delivery fee', () => {
    const products = [{ id: 'product-2', amount: 1, price: 100 }];
    // SAVE5 is seeded as expired (dueDate in the past)
    expect(orderService.calculateOrderTotal(products, 'SAVE5', 5.99)).toBeCloseTo(100 + 5.99);
  });
});

describe('OrderService.transformToDTO total field (via getOrderById/getCurrentCart)', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  it('returns total equal to the subtotal (no discount, no fee) for a created order with no deliveryMethod set', async () => {
    // order-2 is seeded as status 'created' with no deliveryMethod/promo
    const dto = await orderService.getOrderById('order-2', 'user-1');
    expect(dto).not.toBeNull();
    expect(dto!.total).toBeCloseTo(899.99 + 599.99);
  });

  it('returns total equal to subtotal + deliveryMethod.fee once a delivery method snapshot is set on the order', async () => {
    await orderService.setDeliveryDetails(
      'order-2',
      'user-1',
      {
        recipientName: 'Jane Doe',
        phone: '+1 555 123 4567',
        country: 'USA',
        city: 'Springfield',
        street: 'Main St',
        building: '12',
        postalCode: '11111'
      },
      'extra'
    );

    const dto = await orderService.getCurrentCart('user-1');
    expect(dto).not.toBeNull();
    expect(dto!.total).toBeCloseTo(899.99 + 599.99 + 14.99);
  });
});

// Iteration 5.1 (implementation-plan-05.md) — mandatory security guard.
// Closes the gap where GraphQL Playground (or the legacy REST layer, which
// funnels through the same OrderService methods) could edit a paid/cancelled
// order's line items directly, bypassing the "no order editing after
// payment" requirement. This is the real fix; the frontend UI split
// (OrderListItem/OrderHistoryItem) is necessary but not sufficient on its
// own — see tech-design.md §4.6.
describe('OrderService — status guard on deleteProductFromOrder/updateProductAmount', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;

  // 'cancelled' is intentionally NOT included — it does not exist on
  // OrderStatus yet (feature 6's addition); this feature only owns the four
  // statuses that exist today. Feature 6 is responsible for adding a
  // 'cancelled' case to this same guard's coverage once that status lands —
  // the guard code itself (`status !== 'created'`) already covers it by
  // construction, no code change needed there, only test coverage.
  const nonCreatedStatuses: OrderStatus[] = ['submited', 'finished', 'paid'];

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  function seedOrderWithStatus(status: OrderStatus) {
    orderRepository.update({
      orderId: 'order-2',
      userId: 'user-1',
      status,
      createAt: Date.now(),
      products: [
        { id: 'product-2', amount: 1, price: 899.99 },
        { id: 'product-4', amount: 1, price: 599.99 }
      ]
    });
  }

  describe.each(nonCreatedStatuses)('when order.status is %s', (status) => {
    it('deleteProductFromOrder throws and does not mutate order.products', async () => {
      seedOrderWithStatus(status);

      await expect(
        orderService.deleteProductFromOrder('order-2', 'product-2', 'user-1')
      ).rejects.toThrow('Order cannot be modified in its current status');

      expect(orderRepository.findById('order-2')!.products).toHaveLength(2);
    });

    it('updateProductAmount throws and does not mutate order.products', async () => {
      seedOrderWithStatus(status);

      await expect(
        orderService.updateProductAmount('order-2', 'product-2', 5, 'user-1')
      ).rejects.toThrow('Order cannot be modified in its current status');

      expect(orderRepository.findById('order-2')!.products.find(p => p.id === 'product-2')!.amount).toBe(1);
    });
  });

  it('deleteProductFromOrder still succeeds unchanged for a created order (no regression)', async () => {
    // order-2 is seeded as 'created' by default.
    const result = await orderService.deleteProductFromOrder('order-2', 'product-2', 'user-1');
    expect(result).not.toBeNull();
    expect(result!.products.find(p => p.product.id === 'product-2')).toBeUndefined();
  });

  it('updateProductAmount still succeeds unchanged for a created order (no regression)', async () => {
    // order-2 is seeded as 'created' by default.
    const result = await orderService.updateProductAmount('order-2', 'product-2', 3, 'user-1');
    expect(result).not.toBeNull();
    expect(result!.products.find(p => p.product.id === 'product-2')!.amount).toBe(3);
  });

  it('manual-parity check: seed order-1 ("finished") throws for both guarded methods, matching the GraphQL Playground scenario from the design review', async () => {
    await expect(
      orderService.deleteProductFromOrder('order-1', 'product-1', 'user-1')
    ).rejects.toThrow('Order cannot be modified in its current status');

    await expect(
      orderService.updateProductAmount('order-1', 'product-1', 4, 'user-1')
    ).rejects.toThrow('Order cannot be modified in its current status');
  });
});

// Feature 5's closing of the gap flagged explicitly by Feature 4: transformToDTO
// did not populate OrderDTO.payment. Wired via setPaymentService (setter
// injection, avoiding a circular constructor dependency with PaymentService,
// which already depends on OrderService — tech-design.md §2.4).
describe('OrderService.transformToDTO — payment projection and createAt passthrough', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;
  let paymentService: PaymentService;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    const paymentRepository = new InMemoryPaymentRepository();

    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
    paymentService = new PaymentService(paymentRepository, orderRepository, orderService);
  });

  it('order.payment is undefined when setPaymentService was never called (no regression for existing callers)', async () => {
    const dto = await orderService.getOrderById('order-2', 'user-1');
    expect(dto!.payment).toBeUndefined();
  });

  it('order.payment reflects the latest payment summary once setPaymentService is wired and a payment exists', async () => {
    orderService.setPaymentService(paymentService);

    await paymentService.pay('order-2', 'user-1', 'idem-1', {
      cardNumber: '4242424242424242',
      expiry: '09/30',
      cvv: '123',
      cardholderName: 'Jane Doe'
    });

    const dto = await orderService.getOrderById('order-2', 'user-1');
    expect(dto!.payment).toBeDefined();
    expect(dto!.payment!.status).toBe('succeeded');
    expect(dto!.payment!.cardLast4).toBe('4242');
  });

  it('order.createAt is passed through unchanged from the OrderRecord', async () => {
    const dto = await orderService.getOrderById('order-2', 'user-1');
    const record = orderRepository.findById('order-2')!;
    expect(dto!.createAt).toBe(record.createAt);
  });
});

describe('OrderService.transformToDTO — duplicate product line-item merge', () => {
  let orderService: OrderService;
  let orderRepository: InMemoryOrderRepository;

  beforeEach(() => {
    orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    const deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    orderService = new OrderService(orderRepository, productRepository, promoRepository, deliveryMethodRepository);
  });

  it('keeps the first-encountered price for a duplicated product even when that price is legitimately 0 (regression: a falsy check previously let a later duplicate silently overwrite it)', async () => {
    const record = orderRepository.findById('order-2')!;
    orderRepository.update({
      ...record,
      products: [
        { id: 'product-2', amount: 1, price: 0 },
        { id: 'product-2', amount: 1, price: 899.99 }
      ]
    });

    const dto = await orderService.getOrderById('order-2', 'user-1');
    const merged = dto!.products.find(p => p.product.id === 'product-2')!;
    expect(merged.price).toBe(0);
    expect(merged.amount).toBe(2);
  });
});
