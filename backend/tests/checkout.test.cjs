const assert = require('node:assert/strict');
const { test } = require('node:test');
const { OrderService } = require('../dist/services/orderService');
const { MockAcquiringService } = require('../dist/services/acquiringService');
const { validateCheckout } = require('../dist/services/checkoutValidation');
const { CheckoutError, CheckoutValidationError } = require('../dist/errors/checkoutError');
const { CheckoutErrorCode } = require('../dist/types/enums');
const { checkoutSuccess, checkoutFailure } = require('../dist/mappers/checkoutMapper');
const { InMemoryCheckoutRepository } = require('../dist/repositories/checkoutRepository');
const { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } = require('../dist/repositories/implementations');

function input(number = '4242424242424242') {
  return {
    customer: { firstName: ' John ', lastName: ' Doe ', email: 'john@example.com', phone: '+1 (202) 555-0123', address: '123 Main Street', zipcode: '01234' },
    creditCard: { cardholderName: 'John Doe', number, expiryMonth: 12, expiryYear: new Date().getUTCFullYear() + 1, securityCode: '123' }
  };
}

function fixture(provider = new MockAcquiringService()) {
  const orders = new InMemoryOrderRepository();
  const checkouts = new InMemoryCheckoutRepository();
  const promos = new InMemoryPromoRepository();
  const service = new OrderService(orders, new InMemoryProductRepository(), promos, checkouts, provider);
  return { orders, checkouts, promos, service };
}

function assertUnchanged(f) {
  assert.equal(f.orders.findById('order-2').status, 'created');
  assert.equal(f.checkouts.findByOrderId('order-2'), undefined);
}

function assertNoCard(value) {
  const serialized = JSON.stringify(value);
  for (const secret of ['4242424242424242', '4000000000000002', '4000000000000119', 'creditCard', 'cardholderName', 'securityCode', 'expiryMonth', 'expiryYear']) {
    assert.equal(serialized.includes(secret), false, `Unexpected card data: ${secret}`);
  }
}

function assertPaymentReferenceOnly(checkout) {
  assert.equal(typeof checkout.paymentId, 'string');
  assert.equal(typeof checkout.paymentProvider, 'string');
  for (const field of ['payment', 'reference', 'amount', 'currency']) assert.equal(field in checkout, false);
  assertNoCard(checkout);
}

async function expectCheckoutError(promise, code) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof CheckoutError);
    assert.equal(error.code, code);
    assertNoCard([error.message, error.stack, error]);
    return true;
  });
}

test('approval stores only customer info and bank identifiers, using server prices and user ID', async () => {
  let calls = 0;
  const provider = { async charge(request) {
    calls++;
    assert.equal(request.amount, 149998);
    assert.equal(request.currency, 'USD');
    assert.equal(request.orderId, 'order-2');
    assert.equal(request.creditCard.number, '4242424242424242');
    return { status: 'approved', paymentId: 'payment-1', provider: 'bank-1', amount: 149998, currency: 'USD', creditCard: request.creditCard };
  } };
  const f = fixture(provider);
  const request = input();
  request.customer.userId = 'user-2';
  request.customer.paymentId = 'client-supplied-id';
  request.customer.paymentProvider = 'client-supplied-provider';
  request.customer.creditCard = request.creditCard;
  request.products = [{ id: 'product-2', amount: 1, price: 0.01 }];
  request.amount = 1;
  const result = await f.service.submitOrder('order-2', 'user-1', request);
  assert.equal(calls, 1);
  const stored = f.checkouts.findByOrderId('order-2');
  assert.equal(stored.firstName, 'John');
  assert.equal(stored.lastName, 'Doe');
  assert.equal(stored.orderId, 'order-2');
  assert.equal(stored.userId, 'user-1');
  assert.equal(stored.zipcode, '01234');
  assert.equal(stored.paymentId, 'payment-1');
  assert.equal(stored.paymentProvider, 'bank-1');
  assert.deepEqual(result, stored);
  assertPaymentReferenceOnly(stored);
  assert.equal(f.orders.findById('order-2').status, 'submited');
  request.customer.address = 'Changed after submission';
  assert.equal(stored.address, '123 Main Street');
  const dto = await f.service.getOrderById('order-2', 'user-1');
  assert.deepEqual(dto.checkout, stored);
  assertNoCard([result, dto, f.orders.findAll()]);
  assert.equal(await f.service.getOrderById('order-2', 'user-2'), null);
});

test('all customer/card fields are required and invalid inputs throw a coded error before acquiring', async () => {
  let calls = 0;
  const f = fixture({ async charge() { calls++; throw new Error('Must not charge'); } });
  const invalid = [undefined, null, {}, [], { customer: input().customer }];
  for (const section of ['customer', 'creditCard']) {
    for (const field of Object.keys(input()[section])) {
      const missing = input();
      delete missing[section][field];
      invalid.push(missing);
    }
  }
  for (const [section, field, value] of [
    ['customer', 'firstName', '   '], ['customer', 'lastName', 123],
    ['customer', 'email', 'invalid'], ['customer', 'phone', 'letters'],
    ['customer', 'phone', '123'], ['customer', 'address', 'a'.repeat(1001)],
    ['customer', 'zipcode', '1234'], ['customer', 'zipcode', '123456'],
    ['customer', 'zipcode', '12345-123'], ['customer', 'zipcode', 'ABCDE'],
    ['customer', 'zipcode', 12345],
    ['creditCard', 'number', '4242424242424241'], ['creditCard', 'number', '0000000000000000'],
    ['creditCard', 'expiryMonth', 0], ['creditCard', 'expiryMonth', 13],
    ['creditCard', 'expiryMonth', '12'], ['creditCard', 'expiryYear', 2000],
    ['creditCard', 'expiryYear', 10000], ['creditCard', 'securityCode', '12'],
    ['creditCard', 'securityCode', '12a'], ['creditCard', 'number', 4242424242424242]
  ]) {
    const request = input();
    request[section][field] = value;
    invalid.push(request);
  }
  for (const request of invalid) {
    await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', request), CheckoutErrorCode.VALIDATION_ERROR);
    assertUnchanged(f);
  }
  assert.equal(calls, 0);
});

test('expiry remains valid through its UTC month and formatted card numbers normalize', () => {
  const request = input('4242-4242 4242-4242');
  request.creditCard.expiryYear = 2030;
  request.creditCard.expiryMonth = 6;
  assert.equal(validateCheckout(request, new Date('2030-06-30T23:59:59Z')).creditCard.number, '4242424242424242');
  assert.throws(() => validateCheckout(request, new Date('2030-07-01T00:00:00Z')), error =>
    error instanceof CheckoutValidationError && error.code === CheckoutErrorCode.VALIDATION_ERROR);
});

test('US ZIP and ZIP+4 are stored as strings, preserving leading zeros', async () => {
  for (const zipcode of ['01234', '01234-0567']) {
    const f = fixture();
    const request = input();
    request.customer.zipcode = ` ${zipcode} `;
    const checkout = await f.service.submitOrder('order-2', 'user-1', request);
    assert.equal(checkout.zipcode, zipcode);
    assert.equal(f.checkouts.findByOrderId('order-2').zipcode, zipcode);
  }
});

test('ownership, unknown orders and invalid statuses throw before payment', async () => {
  let calls = 0;
  const f = fixture({ async charge() { calls++; throw new Error('Must not charge'); } });
  await expectCheckoutError(f.service.submitOrder('order-2', 'user-2', input()), CheckoutErrorCode.ORDER_NOT_FOUND);
  await expectCheckoutError(f.service.submitOrder('missing', 'user-1', input()), CheckoutErrorCode.ORDER_NOT_FOUND);
  await expectCheckoutError(f.service.submitOrder('order-1', 'user-1', input()), CheckoutErrorCode.INVALID_ORDER_STATUS);
  assert.equal(calls, 0);
  assertUnchanged(f);
});

for (const [number, code] of [
  ['4000000000000002', CheckoutErrorCode.PAYMENT_DECLINED], ['4000000000000119', CheckoutErrorCode.PAYMENT_PROVIDER_ERROR]
]) {
  test(`${code} throws without storing checkout info and permits another attempt`, async () => {
    const f = fixture();
    await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', input(number)), code);
    assertUnchanged(f);
    assertPaymentReferenceOnly(await f.service.submitOrder('order-2', 'user-1', input()));
  });
}

test('provider exceptions are sanitized, not logged, and release the order lock', async () => {
  const f = fixture({ async charge(request) { throw new Error(JSON.stringify(request)); } });
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', input()), CheckoutErrorCode.PAYMENT_PROVIDER_ERROR);
    assert.deepEqual(logs, []);
    assertUnchanged(f);
    assert.equal(f.service.resetCheckout(), true);
  } finally {
    console.error = original;
  }
});

test('invalid acquiring responses throw without storing a checkout or leaving the order locked', async () => {
  for (const result of [null, {}, { status: 'approved', paymentId: 'id' },
    { status: 'approved', paymentId: '', provider: 'bank' }, { status: 'approved', paymentId: 'id', provider: ' ' }]) {
    const f = fixture({ async charge() { return result; } });
    await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', input()), CheckoutErrorCode.PAYMENT_PROVIDER_ERROR);
    assertUnchanged(f);
    assert.equal(f.service.resetCheckout(), true);
  }
});

test('concurrent calls, order edits and resets cannot race payment; retries reuse bank identifiers', async () => {
  let release;
  let calls = 0;
  const f = fixture({ charge() {
    calls++;
    return new Promise(resolve => { release = resolve; });
  } });
  const first = f.service.submitOrder('order-2', 'user-1', input());
  await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', input()), CheckoutErrorCode.ORDER_PROCESSING);
  assert.equal(await f.service.deleteProductFromOrder('order-2', 'product-2', 'user-1'), null);
  assert.equal(await f.service.updateProductAmount('order-2', 'product-2', 5, 'user-1'), null);
  assert.equal(f.service.resetCheckout(), false);
  assertUnchanged(f);
  release({ status: 'approved', paymentId: 'one-charge', provider: 'bank-1' });
  const result = await first;
  const changed = input();
  changed.customer.firstName = 'Different';
  assert.deepEqual(await f.service.submitOrder('order-2', 'user-1', changed), result);
  assert.equal(calls, 1);
  assert.equal(f.checkouts.findByOrderId('order-2').firstName, 'John');
  assert.equal(await f.service.deleteProductFromOrder('order-2', 'product-2', 'user-1'), null);
  assert.equal(await f.service.updateProductAmount('order-2', 'product-2', 5, 'user-1'), null);
});

test('payment sends the stored quantities and promo total to the bank without saving the amount', async () => {
  let chargedAmount;
  const f = fixture({ async charge(request) {
    chargedAmount = request.amount;
    return { status: 'approved', paymentId: 'payment-1', provider: 'bank-1' };
  } });
  const order = f.orders.findById('order-2');
  order.products = [{ id: 'product-2', amount: 3, price: 0.10 }];
  order.promo = f.promos.findById('SAVE10');
  const result = await f.service.submitOrder('order-2', 'user-1', input());
  assert.equal(chargedAmount, 27);
  assertPaymentReferenceOnly(result);
});

test('empty, invalid, negative, zero and unsafe totals throw without payment', async () => {
  for (const products of [[],
    [{ id: 'product-2', amount: 1, price: -1 }],
    [{ id: 'product-2', amount: 1, price: -0.001 }, { id: 'product-4', amount: 1, price: 1 }],
    [{ id: 'product-2', amount: 1, price: 0 }],
    [{ id: 'product-2', amount: 0, price: 1 }],
    [{ id: 'product-2', amount: 1.5, price: 1 }],
    [{ id: 'product-2', amount: 1, price: Number.NaN }],
    [{ id: 'product-2', amount: 10, price: Number.MAX_SAFE_INTEGER }],
    [{ id: 'missing', amount: 1, price: 1 }]
  ]) {
    let calls = 0;
    const f = fixture({ async charge() { calls++; throw new Error('Must not charge'); } });
    f.orders.findById('order-2').products = products;
    await expectCheckoutError(f.service.submitOrder('order-2', 'user-1', input()), CheckoutErrorCode.INVALID_ORDER_TOTAL);
    assert.equal(calls, 0);
    assertUnchanged(f);
  }
});

test('checkout repository excludes payment details and protects customer snapshots', () => {
  const repository = new InMemoryCheckoutRepository();
  const request = input();
  const record = { ...request.customer, orderId: 'order-2', userId: 'user-1', creditCard: request.creditCard,
    paymentId: 'approved', paymentProvider: 'bank-1', amount: 100, currency: 'USD',
    payment: { reference: 'approved', amount: 100, currency: 'USD', securityCode: '123' } };
  repository.save(record);
  record.address = 'Changed by caller';
  const read = repository.findByOrderId('order-2');
  assert.equal(read.address, '123 Main Street');
  assertPaymentReferenceOnly(read);
  read.address = 'Changed through read';
  assert.equal(repository.findByOrderId('order-2').address, '123 Main Street');
  repository.reset();
  assert.equal(repository.findByOrderId('order-2'), undefined);
});

test('API mappers preserve enum codes and sanitize unexpected failures without exposing customer info', async () => {
  for (const code of Object.values(CheckoutErrorCode)) {
    assert.deepEqual(checkoutFailure(new CheckoutError(code, 'Safe message'), 'order-2'), {
      success: false, code, message: 'Safe message', orderId: 'order-2'
    });
  }
  const failure = checkoutFailure(new Error(JSON.stringify(input())), 'order-2');
  assert.equal(failure.code, CheckoutErrorCode.INTERNAL_ERROR);
  assert.equal(failure.message, 'Failed to submit order');
  assertNoCard(failure);
  const f = fixture();
  const checkout = await f.service.submitOrder('order-2', 'user-1', input());
  const success = checkoutSuccess(checkout);
  assert.equal(success.success, true);
  assert.equal(success.code, 'APPROVED');
  assert.equal('email' in success, false);
  assertPaymentReferenceOnly(success);
});

test('reset clears checkout data and starts a new payment lifecycle for reseeded orders', async () => {
  const f = fixture();
  const first = await f.service.submitOrder('order-2', 'user-1', input());
  assert.equal(f.service.resetCheckout(), true);
  f.orders.reset();
  assertUnchanged(f);
  const second = await f.service.submitOrder('order-2', 'user-1', input());
  assertPaymentReferenceOnly(second);
  assert.notEqual(first.paymentId, second.paymentId);
});
