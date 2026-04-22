import request from 'supertest';
import type { Application } from 'express';
import { App } from '../../src/app';

const ADMIN_USER = { login: 'john.doe', password: 'password123' };
const OTHER_USER = { login: 'jane.smith', password: 'password456' };

const SHIPPING = {
  fullName: 'John Doe',
  address: '123 Main St',
  city: 'Springfield',
  zip: '12345',
  country: 'US',
  phone: '+1 555 0100'
};

const GOOD_CARD = {
  number: '4242424242424242',
  holderName: 'John Doe',
  expiryMonth: 12,
  expiryYear: 2030,
  cvv: '123'
};

const DECLINE_CARD = { ...GOOD_CARD, number: '0000111122223333' };

async function bootApp(): Promise<Application> {
  const app = new App();
  // Allow GraphQL apply to resolve; not strictly required for REST-only tests,
  // but keeps behaviour aligned with production.
  await new Promise(resolve => setImmediate(resolve));
  return app.app;
}

async function login(app: Application, creds: typeof ADMIN_USER): Promise<string> {
  const res = await request(app).post('/api/login').send(creds).expect(200);
  return res.body.token;
}

describe('REST integration: checkout flow', () => {
  let app: Application;
  let token: string;

  beforeEach(async () => {
    app = await bootApp();
    token = await login(app, ADMIN_USER);
    await request(app).get('/reset/orders').expect(200);
  });

  it('rejects unauthenticated order list requests', async () => {
    await request(app).get('/api/order').expect(403);
  });

  it('lists orders for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body.map((o: any) => o.status)).toEqual(expect.arrayContaining(['finished', 'created']));
  });

  it('denies access to another user\'s order', async () => {
    const otherToken = await login(app, OTHER_USER);
    await request(app)
      .get('/api/order/order-1')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('completes the happy checkout path', async () => {
    await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(res => expect(res.body.status).toBe('checkout'));

    await request(app)
      .patch('/api/order/order-2/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipping: SHIPPING })
      .expect(200)
      .expect(res => expect(res.body.shipping).toEqual(SHIPPING));

    const place = await request(app)
      .post('/api/order/order-2/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .send({ card: GOOD_CARD })
      .expect(200);
    expect(place.body.status).toBe('submited');
    expect(place.body.payment.last4).toBe('4242');
    expect(place.body.placedAt).toBeDefined();

    const finalList = await request(app)
      .get('/api/order')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const submitted = finalList.body.find((o: any) => o.orderId === 'order-2');
    expect(submitted.status).toBe('submited');
  });

  it('returns 400 when shipping is missing required fields', async () => {
    await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .patch('/api/order/order-2/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipping: { ...SHIPPING, city: '' } })
      .expect(400);
    expect(res.body.error).toBe('INVALID_SHIPPING');
  });

  it('returns 409 for invalid state transitions', async () => {
    // Cannot place without starting checkout
    const res = await request(app)
      .post('/api/order/order-2/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .send({ card: GOOD_CARD })
      .expect(409);
    expect(res.body.error).toBe('INVALID_STATUS');
  });

  it('returns 402 when the payment provider declines', async () => {
    await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .patch('/api/order/order-2/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipping: SHIPPING })
      .expect(200);

    const res = await request(app)
      .post('/api/order/order-2/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .send({ card: DECLINE_CARD })
      .expect(402);
    expect(res.body.error).toBe('PAYMENT_FAILED');

    // Order stays in checkout so user can retry
    const getRes = await request(app)
      .get('/api/order/order-2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.status).toBe('checkout');
  });

  it('cancel at checkout moves order to canceled terminal state', async () => {
    await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const cancelRes = await request(app)
      .post('/api/order/order-2/checkout/cancel')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cancelRes.body.status).toBe('canceled');
    expect(cancelRes.body.canceledAt).toBeDefined();

    // Cannot restart checkout once canceled
    const retry = await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(retry.body.error).toBe('INVALID_STATUS');
  });

  it('refuses to cancel finished orders', async () => {
    const res = await request(app)
      .post('/api/order/order-1/checkout/cancel')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.error).toBe('INVALID_STATUS');
  });

  it('returns 404 for unknown order on start', async () => {
    const res = await request(app)
      .post('/api/order/order-999/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.error).toBe('ORDER_NOT_FOUND');
  });

  it('returns 409 when deleting the last product', async () => {
    // Remove product-4 first so only product-2 remains on order-2
    await request(app)
      .delete('/api/order/order-2/product-4')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const res = await request(app)
      .delete('/api/order/order-2/product-2')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.error).toBe('LAST_PRODUCT');
  });

  it('returns 400 for malformed card payload', async () => {
    await request(app)
      .post('/api/order/order-2/checkout/start')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .patch('/api/order/order-2/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ shipping: SHIPPING })
      .expect(200);

    await request(app)
      .post('/api/order/order-2/checkout/place')
      .set('Authorization', `Bearer ${token}`)
      .send({ card: { number: '4242424242424242', holderName: 'X' } })
      .expect(400);
  });
});
