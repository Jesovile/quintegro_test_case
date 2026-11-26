const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { App } = require('../dist/app');
const { specs } = require('../dist/config/swagger');

const input = (number = '4242424242424242') => ({
  customer: { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+12025550123', address: '123 Main Street', zipcode: '01234' },
  creditCard: { cardholderName: 'John Doe', number, expiryMonth: 12, expiryYear: new Date().getUTCFullYear() + 1, securityCode: '123' }
});
const mutation = `mutation Checkout($orderId: ID!, $input: CheckoutInput!) {
  submitOrder(orderId: $orderId, input: $input) {
    success code message orderId paymentId paymentProvider
  }
}`;

function noCard(value) {
  assert.doesNotMatch(JSON.stringify(value), /4242424242424242|4000000000000002|4000000000000119|securityCode|cardholderName|creditCard/);
}

test('REST and GraphQL checkout contracts share storage, enforce payment, and sanitize errors', async t => {
  const app = new App();
  const apollo = await app.ready;
  const server = app.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await apollo.stop();
  });
  // Preserve the project's deliberate every-fifth-request error middleware.
  async function request(path, body, token, method = body === undefined ? 'GET' : 'POST') {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      if (data.error === 'Test planned server error') continue;
      return { status: response.status, data };
    }
    throw new Error('Unexpected repeated planned middleware failure');
  }
  const login = await request('/api/login', { login: 'john.doe', password: 'password123' });
  assert.equal(login.status, 200);
  const token = login.data.token;
  const context = { req: { headers: { authorization: `Bearer ${token}` } } };
  const execute = (query, variables, ctx = context) => apollo.executeOperation({ query, variables }, ctx);

  await t.test('submission requires authentication and checkout details', async () => {
    const unauth = await request('/api/order/order-2', input());
    assert.equal(unauth.status, 403);
    assert.equal(unauth.data.code, 'AUTHENTICATION_REQUIRED');
    const missing = await request('/api/order/order-2', {}, token);
    assert.equal(missing.status, 400);
    assert.equal(missing.data.code, 'VALIDATION_ERROR');
    const gqlUnauth = await execute(mutation, { orderId: 'order-2', input: input() }, { req: { headers: {} } });
    assert.equal(gqlUnauth.data.submitOrder.code, 'AUTHENTICATION_REQUIRED');
    const oldMutation = await execute('mutation { submitOrder(orderId: "order-2") }');
    assert.ok(oldMutation.errors);
    const unknown = await request('/api/order/missing', input(), token);
    assert.equal(unknown.status, 404);
    const finished = await request('/api/order/order-1', input(), token);
    assert.equal(finished.status, 409);
  });

  await t.test('decline and provider error leave orders unchanged with no checkout information', async () => {
    for (const [number, status, code] of [['4000000000000002', 402, 'PAYMENT_DECLINED'], ['4000000000000119', 502, 'PAYMENT_PROVIDER_ERROR']]) {
      const result = await request('/api/order/order-2', input(number), token);
      assert.equal(result.status, status);
      assert.equal(result.data.code, code);
      noCard(result);
      const gql = await execute('{ order(orderId: "order-2") { status checkout { firstName } } }');
      assert.equal(gql.data.order.status, 'created');
      assert.equal(gql.data.order.checkout, null);
    }
  });

  let bankReference;
  await t.test('REST approval is visible through GraphQL and its retry returns the same bank identifiers', async () => {
    const paid = await request('/api/order/order-2', input(), token);
    assert.equal(paid.status, 200);
    bankReference = { paymentId: paid.data.paymentId, paymentProvider: paid.data.paymentProvider };
    assert.equal(typeof bankReference.paymentId, 'string');
    assert.equal(bankReference.paymentProvider, 'mock');
    for (const field of ['payment', 'amount', 'currency']) assert.equal(field in paid.data, false);
    noCard(paid);
    const gql = await request('/graphql', { query: '{ order(orderId: "order-2") { status checkout { userId orderId firstName address zipcode paymentId paymentProvider } } }' }, token);
    assert.equal(gql.data.errors, undefined);
    assert.equal(gql.data.data.order.status, 'submited');
    assert.equal(gql.data.data.order.checkout.userId, 'user-1');
    assert.equal(gql.data.data.order.checkout.zipcode, '01234');
    assert.equal(gql.data.data.order.checkout.paymentId, bankReference.paymentId);
    assert.equal(gql.data.data.order.checkout.paymentProvider, bankReference.paymentProvider);
    for (const field of ['payment', 'amount', 'currency']) assert.equal(field in gql.data.data.order.checkout, false);
    const repeated = await execute(mutation, { orderId: 'order-2', input: input() });
    assert.deepEqual(JSON.parse(JSON.stringify(repeated.data.submitOrder)), paid.data);
    const forbidden = await execute('{ order(orderId: "order-2") { checkout { email } } }', undefined,
      { req: { headers: { authorization: `Bearer ${(await request('/api/login', { login: 'jane.smith', password: 'password456' })).data.token}` } } });
    assert.ok(forbidden.errors);
  });

  await t.test('reset clears checkout references and GraphQL approval is visible through REST', async () => {
    assert.equal((await request('/reset/orders')).status, 200);
    const cleared = await request('/api/order/order-2', undefined, token);
    assert.equal(cleared.data.status, 'created');
    assert.equal(cleared.data.checkout, undefined);
    const paid = await execute(mutation, { orderId: 'order-2', input: input() });
    assert.equal(paid.errors, undefined);
    assert.equal(paid.data.submitOrder.code, 'APPROVED');
    assert.notEqual(paid.data.submitOrder.paymentId, bankReference.paymentId);
    const read = await request('/api/order/order-2', undefined, token);
    assert.equal(read.data.status, 'submited');
    assert.equal(read.data.checkout.email, 'john@example.com');
    assert.equal(read.data.checkout.zipcode, '01234');
    for (const field of ['payment', 'amount', 'currency']) assert.equal(field in read.data.checkout, false);
    noCard(read);
  });

  await t.test('GraphQL variable coercion, validation, and parser errors do not leak card values or log them', async () => {
    const logs = [];
    const original = console.error;
    console.error = (...args) => logs.push(args);
    try {
      const invalid = input();
      invalid.creditCard.expiryMonth = '4242424242424242';
      const badVariables = await execute(mutation, { orderId: 'order-2', input: invalid });
      assert.ok(badVariables.errors);
      noCard(badVariables);
      const badLiteral = await execute('mutation { submitOrder(orderId: "order-2", input: {creditCard: {number: "4242424242424242"}}) { success } }');
      assert.ok(badLiteral.errors);
      noCard(badLiteral);
      const badSyntax = await execute('mutation { submitOrder(orderId: 4242424242424242, input: "4242424242424242"');
      assert.ok(badSyntax.errors);
      noCard(badSyntax);
      assert.deepEqual(logs, []);
    } finally {
      console.error = original;
    }
  });

  await t.test('malformed REST JSON does not echo raw card values', async () => {
    const response = await fetch(base + '/api/order/order-2', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"number":"4242424242424242"'
    });
    assert.equal(response.status, 400);
    noCard(await response.json());
  });
});

test('Swagger documents required checkout input and structured payment results', () => {
  assert.equal(specs.components.schemas.Payment, undefined);
  assert.equal(specs.components.schemas.Checkout.allOf[1].properties.payment, undefined);
  const submit = specs.paths['/api/order/{orderId}'].post;
  assert.equal(submit.requestBody.required, true);
  assert.equal(submit.requestBody.content['application/json'].schema.$ref, '#/components/schemas/CheckoutInput');
  for (const status of [200, 400, 402, 403, 404, 409, 500, 502]) assert.ok(submit.responses[status]);
  assert.deepEqual(specs.components.schemas.CustomerInfo.required, ['firstName', 'lastName', 'email', 'phone', 'address', 'zipcode']);
});
