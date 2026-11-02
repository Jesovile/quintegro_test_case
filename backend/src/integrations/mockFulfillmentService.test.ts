import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockGeoService } from './mock/mockGeoService';
import { FULFILLMENT_FAILURE_MARKER, MockFulfillmentService } from './mock/mockFulfillmentService';

describe('MockFulfillmentService', () => {
  let geo: MockGeoService;

  const refFor = async (line1: string) => {
    const result = await geo.validateAddress({ line1, city: 'Springfield', state: 'IL', zip: '62701' });
    if (!result.ok) {
      throw new Error('address rejected');
    }
    return result.addressRef;
  };

  const start = (service: MockFulfillmentService, addressRef: string, idempotencyKey: string) =>
    service.start({ orderId: 'order-2', addressRef, idempotencyKey });

  beforeEach(() => {
    geo = new MockGeoService(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start returns a job that is done once its duration has passed', async () => {
    const service = new MockFulfillmentService(geo, 0, 0);

    const { jobId } = await start(service, await refFor('1 Main St'), 'k1');

    expect(jobId).toEqual(expect.any(String));
    expect(await service.getStatus(jobId)).toEqual({ status: 'done' });
  });

  it('a job is running until its duration has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const service = new MockFulfillmentService(geo, 5000, 0);
    const { jobId } = await start(service, await refFor('1 Main St'), 'k1');

    expect(await service.getStatus(jobId)).toEqual({ status: 'running' });
    vi.advanceTimersByTime(5001);
    expect(await service.getStatus(jobId)).toEqual({ status: 'done' });
  });

  it(`"${FULFILLMENT_FAILURE_MARKER}" in the street fails the first job of the order; a retry succeeds`, async () => {
    const service = new MockFulfillmentService(geo, 0, 0);
    const addressRef = await refFor('1 fail St');

    const first = await start(service, addressRef, 'k1');
    const retry = await start(service, addressRef, 'k2');

    expect(await service.getStatus(first.jobId)).toEqual({ status: 'failed' });
    expect(await service.getStatus(retry.jobId)).toEqual({ status: 'done' });
  });

  it('an unknown address reference makes the job fail', async () => {
    const service = new MockFulfillmentService(geo, 0, 0);

    const { jobId } = await start(service, 'addr_unknown', 'k1');

    expect(await service.getStatus(jobId)).toEqual({ status: 'failed' });
  });

  it('the same idempotency key returns the same job; a new key starts a new one', async () => {
    const service = new MockFulfillmentService(geo, 0, 0);
    const addressRef = await refFor('1 Main St');

    const first = await start(service, addressRef, 'k1');
    const repeated = await start(service, addressRef, 'k1');
    const next = await start(service, addressRef, 'k2');

    expect(repeated.jobId).toBe(first.jobId);
    expect(next.jobId).not.toBe(first.jobId);
    expect(await service.getStatus('job_nope')).toEqual({ status: 'failed' });
  });
});

describe('MockFulfillmentService.reset', () => {
  it('forgets jobs, keys and the failing first job, like a fresh service', async () => {
    const geo = new MockGeoService(0);
    const result = await geo.validateAddress({ line1: '1 FAIL St', city: 'Springfield', state: 'IL', zip: '62701' });
    const addressRef = result.ok ? result.addressRef : '';
    const service = new MockFulfillmentService(geo, 0, 0);

    const before = await service.start({ orderId: 'order-2', addressRef, idempotencyKey: 'k1' });
    service.reset();
    const after = await service.start({ orderId: 'order-2', addressRef, idempotencyKey: 'k1' });

    expect(after.jobId).not.toBe(before.jobId);
    expect(await service.getStatus(before.jobId)).toEqual({ status: 'failed' });
    // The first job of the order fails again, as on a fresh backend
    expect(await service.getStatus(after.jobId)).toEqual({ status: 'failed' });
  });
});
