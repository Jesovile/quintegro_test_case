import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryCheckoutStore, InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { MockDeliveryGateway } from './adapters/mockDeliveryGateway';
import { MockPaymentGateway } from './adapters/mockPaymentGateway';
import { CheckoutService } from './checkoutService';
import { OrderService } from '../services/orderService';

const deliveryAddress = {
  fullName: 'John Doe',
  street: 'Main street 1',
  city: 'New York',
  postalCode: '10001',
  country: 'US',
};

function createService() {
  const orderRepository = new InMemoryOrderRepository();
  const productRepository = new InMemoryProductRepository();
  const promoRepository = new InMemoryPromoRepository();
  const checkoutStore = new InMemoryCheckoutStore(orderRepository);
  return {
    orderRepository,
    orderService: new OrderService(orderRepository, productRepository, promoRepository, checkoutStore),
    service: new CheckoutService(orderRepository, productRepository, promoRepository, checkoutStore, new MockPaymentGateway(), new MockDeliveryGateway()),
  };
}

async function quoteFor(service: CheckoutService) {
  return service.createQuote({
    orderId: 'order-2',
    products: [{ productId: 'product-2', quantity: 1 }, { productId: 'product-4', quantity: 1 }],
    deliveryAddress,
    deliveryMethod: 'standard',
  }, 'user-1');
}

test('checkout uses stored prices, persists a snapshot, and is idempotent', async () => {
  const { service, orderRepository } = createService();
  const quote = await quoteFor(service);
  assert.equal(quote.subtotalMinor, 149998);
  assert.equal(quote.totalMinor, 150997);

  const input = {
    orderId: 'order-2', attemptId: 'attempt-1', quoteId: quote.id, quoteFingerprint: quote.fingerprint,
    expectedTotalMinor: quote.totalMinor, paymentMethod: { token: 'mock_visa_4242', brand: 'Visa', last4: '4242' },
  };
  const result = await service.submitOrder(input, 'user-1');
  const retry = await service.submitOrder(input, 'user-1');

  assert.equal(result.status, 'completed');
  assert.deepEqual(retry, result);
  assert.equal(orderRepository.findById('order-2')?.status, 'submited');
  assert.equal(orderRepository.findById('order-2')?.checkout?.payment.last4, '4242');
});

test('completed orders remain readable but cannot be edited', async () => {
  const { service, orderRepository, orderService } = createService();
  const quote = await quoteFor(service);
  await service.submitOrder({
    orderId: 'order-2', attemptId: 'attempt-completed-order', quoteId: quote.id, quoteFingerprint: quote.fingerprint,
    expectedTotalMinor: quote.totalMinor, paymentMethod: { token: 'mock_visa_4242', brand: 'Visa', last4: '4242' },
  }, 'user-1');

  assert.equal((await orderService.getOrderById('order-2', 'user-1'))?.checkout?.payment.last4, '4242');
  assert.equal(await orderService.updateProductAmount('order-2', 'product-2', 2, 'user-1'), null);
  assert.equal(orderRepository.findById('order-2')?.products[0].amount, 1);
});

test('a declined payment leaves the cart editable and never submits the order', async () => {
  const { service, orderRepository } = createService();
  const quote = await quoteFor(service);
  const result = await service.submitOrder({
    orderId: 'order-2', attemptId: 'attempt-declined', quoteId: quote.id, quoteFingerprint: quote.fingerprint,
    expectedTotalMinor: quote.totalMinor, paymentMethod: { token: 'mock_visa_0002_decline', brand: 'Visa', last4: '0002' },
  }, 'user-1');

  assert.equal(result.status, 'payment_failed');
  assert.equal(result.errorCode, 'PAYMENT_DECLINED');
  assert.equal(orderRepository.findById('order-2')?.status, 'created');
  assert.equal((await quoteFor(service)).totalMinor, quote.totalMinor);
});

test('retryable payment outcomes require a new attempt and do not lock the cart', async () => {
  const { service, orderRepository } = createService();
  const quote = await quoteFor(service);
  const baseInput = {
    orderId: 'order-2', quoteId: quote.id, quoteFingerprint: quote.fingerprint, expectedTotalMinor: quote.totalMinor,
  };

  const unavailable = await service.submitOrder({
    ...baseInput,
    attemptId: 'attempt-unavailable',
    paymentMethod: { token: 'mock_visa_0004_unavailable', brand: 'Visa', last4: '0004' },
  }, 'user-1');

  const retry = await service.submitOrder({
    ...baseInput,
    attemptId: 'attempt-after-unavailable',
    paymentMethod: { token: 'mock_visa_4242', brand: 'Visa', last4: '4242' },
  }, 'user-1');

  assert.equal(unavailable.status, 'payment_failed');
  assert.equal(retry.status, 'completed');
  assert.equal(orderRepository.findById('order-2')?.status, 'submited');
});

test('an action-required payment does not block a subsequent payment attempt', async () => {
  const { service } = createService();
  const quote = await quoteFor(service);
  const baseInput = {
    orderId: 'order-2', quoteId: quote.id, quoteFingerprint: quote.fingerprint, expectedTotalMinor: quote.totalMinor,
  };

  const actionRequired = await service.submitOrder({
    ...baseInput,
    attemptId: 'attempt-action-required',
    paymentMethod: { token: 'mock_visa_0003_action', brand: 'Visa', last4: '0003' },
  }, 'user-1');

  const retry = await service.submitOrder({
    ...baseInput,
    attemptId: 'attempt-after-action-required',
    paymentMethod: { token: 'mock_visa_4242', brand: 'Visa', last4: '4242' },
  }, 'user-1');

  assert.equal(actionRequired.status, 'action_required');
  assert.equal(retry.status, 'completed');
});

test('a delivery failure voids the authorization and keeps the order unsubmitted', async () => {
  const { service, orderRepository } = createService();
  const quote = await service.createQuote({
    orderId: 'order-2',
    products: [{ productId: 'product-2', quantity: 1 }, { productId: 'product-4', quantity: 1 }],
    deliveryAddress: { ...deliveryAddress, postalCode: 'schedule_fail' },
    deliveryMethod: 'standard',
  }, 'user-1');
  const result = await service.submitOrder({
    orderId: 'order-2', attemptId: 'attempt-delivery-failure', quoteId: quote.id, quoteFingerprint: quote.fingerprint,
    expectedTotalMinor: quote.totalMinor, paymentMethod: { token: 'mock_visa_4242', brand: 'Visa', last4: '4242' },
  }, 'user-1');

  assert.equal(result.status, 'payment_failed');
  assert.equal(result.errorCode, 'DELIVERY_UNAVAILABLE');
  assert.equal(orderRepository.findById('order-2')?.status, 'created');
});
