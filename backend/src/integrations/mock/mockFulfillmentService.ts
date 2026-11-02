import { randomUUID } from 'crypto';
import { FulfillmentStatus, IFulfillmentService, IGeoService } from '../interfaces';

// A street address containing this marker makes the first job of the order fail; a retry then succeeds
export const FULFILLMENT_FAILURE_MARKER = 'FAIL';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockFulfillmentService implements IFulfillmentService {
  private jobs = new Map<string, { finishAt: number; fails: boolean }>();
  private jobsByKey = new Map<string, string>();
  private jobCountByOrder = new Map<string, number>();

  constructor(
    private geoService: IGeoService,
    private jobDurationMs = 5000,
    private delayMs = 200
  ) {}

  async start({ orderId, addressRef, idempotencyKey }: { orderId: string; addressRef: string; idempotencyKey: string }): Promise<{ jobId: string }> {
    await wait(this.delayMs);

    const existing = this.jobsByKey.get(idempotencyKey);
    if (existing) {
      return { jobId: existing };
    }

    const address = await this.geoService.getAddress(addressRef);
    const jobNumber = (this.jobCountByOrder.get(orderId) ?? 0) + 1;
    this.jobCountByOrder.set(orderId, jobNumber);

    const jobId = `job_${randomUUID()}`;
    this.jobsByKey.set(idempotencyKey, jobId);
    this.jobs.set(jobId, {
      finishAt: Date.now() + this.jobDurationMs,
      fails: !address || (jobNumber === 1 && address.line1.toUpperCase().includes(FULFILLMENT_FAILURE_MARKER))
    });
    return { jobId };
  }

  async getStatus(jobId: string): Promise<{ status: FulfillmentStatus }> {
    await wait(this.delayMs);

    const job = this.jobs.get(jobId);
    if (!job) {
      return { status: 'failed' };
    }
    if (Date.now() < job.finishAt) {
      return { status: 'running' };
    }
    return { status: job.fails ? 'failed' : 'done' };
  }
}
