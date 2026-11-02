import { OrderDTO, OrderRecord } from '../types/entities';
import { IOrderRepository } from '../repositories/interfaces';
import { IFulfillmentService, IntegrationUnavailableError, withTimeout } from '../integrations/interfaces';
import { DomainError } from '../errors/domainError';
import { OrderService } from './orderService';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_INTERVAL_MS = 1000;

const startKey = (orderId: string, attempt: number) => `fulfillment_${orderId}_${attempt}`;

// Moves paid orders through processing to delivery on the server, so it does not depend on an open browser tab
export class ProcessingService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private ticking = false;
  // Orders whose retry is calling the fulfillment service right now
  private retrying = new Set<string>();
  // Broken orders are reported once, not on every pass
  private reported = new Set<string>();

  constructor(
    private orderRepository: IOrderRepository,
    private orderService: OrderService,
    private fulfillmentService: IFulfillmentService,
    private timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  startWorker(intervalMs = DEFAULT_INTERVAL_MS): void {
    this.timer ??= setInterval(() => {
      this.tick().catch(error => console.error('Processing worker failed', error instanceof Error ? error.name : 'unknown'));
    }, intervalMs);
  }

  stopWorker(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  // Test helper for a reset backend: forgets which orders were reported
  resetState(): void {
    this.reported.clear();
  }

  // One pass over the orders; a pass never overlaps the previous one and one broken order never stops the others
  async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      for (const { orderId } of this.orderRepository.findAll()) {
        // Read each order when its turn comes: earlier steps of the pass await external calls
        const order = this.orderRepository.findById(orderId);
        try {
          // An order being cancelled is left alone: the cancellation decides its next status
          if (!order || order.cancelRequested) {
            continue;
          }
          if (order.status === 'paid') {
            await this.startProcessing(order);
          } else if (order.status === 'processing' && order.fulfillment && !order.fulfillment.failed) {
            await this.checkProcessing(order.orderId, order.fulfillment.jobId);
          }
        } catch (error) {
          this.reportOnce(orderId, 'Processing an order failed', error instanceof Error ? error.name : 'unknown');
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  async retryProcessing(orderId: string, userId: string): Promise<OrderDTO> {
    const order = this.findOwnOrder(orderId, userId);

    // Already restarted, being restarted or finished: a repeated click changes nothing
    const alreadyMoving = order.status === 'processing' && !order.fulfillment?.failed;
    if (alreadyMoving || order.status === 'deliver' || this.retrying.has(orderId)) {
      return this.orderService.toDTO(order);
    }
    if (order.cancelRequested) {
      throw new DomainError('INVALID_STATUS_TRANSITION', 'The order is being cancelled');
    }
    if (order.status !== 'processing' || !order.addressRef || !order.fulfillment) {
      throw new DomainError('INVALID_STATUS_TRANSITION', 'Processing cannot be restarted for this order');
    }

    // Claimed synchronously before the external call, so parallel retries start one job
    this.retrying.add(orderId);
    try {
      const attempt = order.fulfillment.attempt + 1;
      const jobId = await this.startJob(orderId, order.addressRef, attempt);
      if (!jobId) {
        throw new DomainError('PROCESSING_FAILED', 'Processing could not be restarted. Please try again.');
      }
      // A cancellation that began meanwhile wins: the new job is stopped
      const current = this.orderRepository.findById(orderId);
      const updated = current && !current.cancelRequested
        ? this.orderRepository.transition(orderId, ['processing'], { fulfillment: { jobId, failed: false, attempt } })
        : null;
      if (!updated) {
        await this.stopJob(orderId, jobId);
        throw new DomainError('INVALID_STATUS_TRANSITION', 'The order has changed');
      }
      return this.orderService.toDTO(updated);
    } finally {
      this.retrying.delete(orderId);
    }
  }

  private async startProcessing(order: OrderRecord): Promise<void> {
    if (!order.addressRef) {
      this.reportOnce(order.orderId, 'Paid order without an address');
      return;
    }
    // The key is the same on every pass until the start succeeds, so a lost answer never creates a second job
    const attempt = 1;
    const jobId = await this.startJob(order.orderId, order.addressRef, attempt);
    if (!jobId) {
      // Stays paid; the next pass tries again
      return;
    }

    const current = this.orderRepository.findById(order.orderId);
    const updated = current?.status === 'paid' && !current.cancelRequested
      ? this.orderRepository.transition(order.orderId, ['paid'], { status: 'processing', fulfillment: { jobId, failed: false, attempt } })
      : null;
    if (!updated) {
      // The order was cancelled while the job was starting: the goods must not leave
      await this.stopJob(order.orderId, jobId);
    }
  }

  private async checkProcessing(orderId: string, jobId: string): Promise<void> {
    const result = await this.call(orderId, () => this.fulfillmentService.getStatus(jobId));
    // Only the job that is still current may finish the order, and not while it is being cancelled (AC-5.6)
    const current = this.orderRepository.findById(orderId);
    if (!result || current?.status !== 'processing' || current.fulfillment?.jobId !== jobId || current.cancelRequested) {
      return;
    }
    if (result.status === 'done') {
      this.orderRepository.transition(orderId, ['processing'], { status: 'deliver' });
    } else if (result.status === 'failed' || result.status === 'cancelled') {
      console.warn('Processing failed', { orderId });
      this.orderRepository.transition(orderId, ['processing'], { fulfillment: { ...current.fulfillment, failed: true } });
    }
  }

  private async startJob(orderId: string, addressRef: string, attempt: number): Promise<string | null> {
    const idempotencyKey = startKey(orderId, attempt);
    const started = await this.call(orderId, () => this.fulfillmentService.start({ orderId, addressRef, idempotencyKey }));
    return started?.jobId ?? null;
  }

  // Best effort: a job that cannot be stopped now is reported for a manual check
  private async stopJob(orderId: string, jobId: string): Promise<void> {
    const result = await this.call(orderId, () => this.fulfillmentService.cancel(jobId));
    if (result?.status !== 'cancelled') {
      console.error('A job for a cancelled order could not be stopped', { orderId, jobId });
    }
  }

  // An outage returns null and is retried on the next pass; any other error is a bug
  private async call<T>(orderId: string, call: () => Promise<T>): Promise<T | null> {
    try {
      return await withTimeout(call(), this.timeoutMs, 'Fulfillment service');
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        console.warn('Fulfillment service unavailable', { orderId });
        return null;
      }
      throw error;
    }
  }

  private reportOnce(orderId: string, message: string, reason?: string): void {
    if (!this.reported.has(orderId)) {
      this.reported.add(orderId);
      console.error(message, reason ? { orderId, reason } : { orderId });
    }
  }

  private findOwnOrder(orderId: string, userId: string): OrderRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new DomainError('ORDER_NOT_FOUND', 'Order not found or access denied');
    }
    return order;
  }
}
