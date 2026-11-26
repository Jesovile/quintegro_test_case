const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const ts = require('typescript');

// This pure form module has no imports; use the installed compiler without adding a test framework.
const compiled = ts.transpileModule(readFileSync(resolve(__dirname, '../src/lib/checkout.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const checkout = {};
new Function('exports', compiled)(checkout);
const { buildCheckoutInput, validateCheckoutForm, formatCardNumber, paymentErrorMessage, emptyCustomer, emptyCard } = checkout;
const now = new Date('2030-06-30T23:59:59Z');
const customer = () => ({ firstName: ' John ', lastName: ' Doe ', email: 'john@example.com', phone: '+1 (202) 555-0123',
  state: ' New York ', address: ' 123 Main Street, Albany ', zipcode: ' 01234-0567 ' });
const card = () => ({ cardholderName: ' John Doe ', number: '4242 4242 4242 4242', expiryMonth: '06', expiryYear: '2030', securityCode: '012' });

test('checkout builds the full address with state and sends a separate ZIP string', () => {
  const result = buildCheckoutInput(customer(), card());
  assert.deepEqual(result.customer, { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+1 (202) 555-0123',
    address: '123 Main Street, Albany, New York', zipcode: '01234-0567' });
  assert.deepEqual(result.creditCard, { cardholderName: 'John Doe', number: '4242424242424242', expiryMonth: 6, expiryYear: 2030, securityCode: '012' });
  assert.equal(result.customer.state, undefined);
  assert.deepEqual(validateCheckoutForm(customer(), card(), now), {});
});

test('all customer, address and card fields are required', () => {
  const errors = validateCheckoutForm(emptyCustomer, emptyCard, now);
  assert.deepEqual(Object.keys(errors).sort(), [...Object.keys(emptyCustomer), ...Object.keys(emptyCard)].sort());
});

test('ZIP accepts five digits and ZIP+4, preserving leading zeros and rejecting other formats', () => {
  for (const zipcode of ['01234', '01234-0567']) {
    assert.equal(validateCheckoutForm({ ...customer(), zipcode }, card(), now).zipcode, undefined);
    assert.equal(buildCheckoutInput({ ...customer(), zipcode }, card()).customer.zipcode, zipcode);
  }
  for (const zipcode of ['1234', '123456', '12345-123', '12345-12345', 'ABCDE', '12 345']) {
    assert.ok(validateCheckoutForm({ ...customer(), zipcode }, card(), now).zipcode);
  }
});

test('invalid email, phone, blank state, and excessive combined address length are rejected', () => {
  for (const [field, value] of [['email', 'wrong'], ['phone', '123'], ['phone', 'abc1234567'], ['state', '   '],
    ['firstName', 'a'.repeat(101)], ['lastName', 'a'.repeat(101)]]) {
    assert.ok(validateCheckoutForm({ ...customer(), [field]: value }, card(), now)[field]);
  }
  assert.ok(validateCheckoutForm({ ...customer(), address: 'a'.repeat(999) }, card(), now).address);
});

test('card validation rejects invalid number, expiry and security code without exposing values', () => {
  for (const [field, value] of [['number', '4242424242424241'], ['number', '0000000000000000'], ['number', 'not a card'],
    ['expiryMonth', '00'], ['expiryMonth', '13'], ['expiryMonth', '05'], ['expiryYear', '2029'], ['expiryYear', '30'],
    ['securityCode', '12'], ['securityCode', '12a']]) {
    const errors = validateCheckoutForm(customer(), { ...card(), [field]: value }, now);
    assert.ok(errors[field]);
    assert.equal(JSON.stringify(errors).includes(value), false);
  }
  assert.deepEqual(validateCheckoutForm(customer(), card(), now), {});
  assert.ok(validateCheckoutForm(customer(), card(), new Date('2030-07-01T00:00:00Z')).expiryMonth);
});

test('card number formatting supports up to nineteen digits', () => {
  assert.equal(formatCardNumber('4242-4242 4242-4242'), '4242 4242 4242 4242');
  assert.equal(formatCardNumber('123456789012345678901234'), '1234 5678 9012 3456 789');
});

test('payment errors use provider-independent messages including a safe network fallback', () => {
  assert.match(paymentErrorMessage('PAYMENT_DECLINED'), /declined/);
  assert.match(paymentErrorMessage('PAYMENT_PROVIDER_ERROR'), /unavailable/);
  assert.match(paymentErrorMessage('AUTHENTICATION_REQUIRED'), /sign in/i);
  assert.match(paymentErrorMessage('ORDER_PROCESSING'), /in progress/);
  assert.match(paymentErrorMessage('NETWORK_ERROR'), /not be charged again/);
  assert.equal(paymentErrorMessage('provider response with secrets'), paymentErrorMessage('INTERNAL_ERROR'));
});
