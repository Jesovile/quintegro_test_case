import { OrderDTO, OrderRecord, PaymentRecord } from '../types/entities';
import { IOrderRepository } from '../repositories/interfaces';
import { IBankGateway, IFulfillmentService, IntegrationUnavailableError, withTimeout } from '../integrations/interfaces';
import { DomainError } from '../errors/domainError';
import { OrderService } from './orderService';
import { PaymentSettlement } from './paymentService';
import { canTransition } from './orderStateMachine';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_BACKGROUND_MS = 10000;

const refundKey = (paymentId: string) => `refund_${paymentId}`;

// 'unknown': the bank did not answer, the refund may or may not have happened
type RefundOutcome = 'refunded' | 'declined' | 'unknown';

export class CancellationService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private backgroundRunning = false;
  // A cancellation in progress per order; a parallel request gets its result instead of starting another
  private inFlight = new Map<string, Promise<OrderDTO>>();

  constructor(
    private orderRepository: IOrderRepository,
    private orderService: OrderService,
    private payments: PaymentSettlement,
    private bankGateway: IBankGateway,
    private fulfillmentService: IFulfillmentService,
    private timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  async cancelOrder(orderId: string, userId: string): Promise<OrderDTO> {
    const order = this.findOwnOrder(orderId, userId);

    // A repeated cancellation returns the order without a second refund
    if (order.status === 'cancelled') {
      return this.orderService.toDTO(order);
    }
    const running = this.inFlight.get(orderId);
    if (running) {
      return running;
    }
    if (order.cancelRequested) {
      throw new DomainError('REFUND_UNCONFIRMED', 'We are confirming the refund with the bank. The order will be cancelled shortly.');
    }
    if (!canTransition(order.status, 'cancelled')) {
      throw new DomainError('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled');
    }

    const cancellation = this.runCancellation(orderId, userId);
    this.inFlight.set(orderId, cancellation);
    try {
      return await cancellation;
    } finally {
      this.inFlight.delete(orderId);
    }
  }

  startRefundRetries(intervalMs = DEFAULT_BACKGROUND_MS): void {
    this.timer ??= setInterval(() => {
      this.runBackgroundPass().catch(error => console.error('Refund retry failed', error instanceof Error ? error.name : 'unknown'));
    }, intervalMs);
  }

  stopRefundRetries(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  // Finishes cancellations whose refund answer was lost; a pass never overlaps the previous one
  async reconcileCancellations(): Promise<void> {
    for (const { orderId } of this.orderRepository.findAll()) {
      const order = this.orderRepository.findById(orderId);
      if (!order?.cancelRequested || this.inFlight.has(orderId) || (order.status !== 'paid' && order.status !== 'processing')) {
        continue;
      }
      try {
        await this.reconcile(order);
      } catch (error) {
        console.error('Cancellation reconcile failed', { orderId, reason: error instanceof Error ? error.name : 'unknown' });
      }
    }
  }

  // Refunds of late charges that the bank did not confirm at the time are repeated until they succeed
  async retryPendingRefunds(): Promise<void> {
    for (const { orderId } of this.orderRepository.findAll()) {
      for (const pending of this.orderRepository.findById(orderId)?.refundsPending ?? []) {
        try {
          if ((await this.refund(orderId, pending.paymentId, pending.amountUsd)) !== 'refunded') {
            continue;
          }
          const current = this.orderRepository.findById(orderId);
          if (current) {
            this.orderRepository.transition(orderId, [current.status], {
              refundsPending: (current.refundsPending ?? []).filter(item => item.paymentId !== pending.paymentId)
            });
          }
        } catch (error) {
          console.error('Pending refund failed', { orderId, paymentId: pending.paymentId, reason: error instanceof Error ? error.name : 'unknown' });
        }
      }
    }
  }

  private async runBackgroundPass(): Promise<void> {
    if (this.backgroundRunning) {
      return;
    }
    this.backgroundRunning = true;
    try {
      await this.reconcileCancellations();
      await this.retryPendingRefunds();
    } finally {
      this.backgroundRunning = false;
    }
  }

  private async runCancellation(orderId: string, userId: string): Promise<OrderDTO> {
    let order = this.findOwnOrder(orderId, userId);

    if (order.status === 'checkout') {
      // An unresolved payment attempt is settled first: if the money was taken, the order is paid and refunded below
      if ((await this.payments.settlePendingPayment(orderId)) === 'clear') {
        const cancelled = this.cancelWithoutPayment(orderId);
        if (cancelled) {
          return cancelled;
        }
      }
      order = this.findOwnOrder(orderId, userId);
      if (order.status === 'cancelled') {
        return this.orderService.toDTO(order);
      }
    }

    return this.cancelPaid(order);
  }

  // Synchronous: a payment attempt that started meanwhile wins over the cancellation
  private cancelWithoutPayment(orderId: string): OrderDTO | null {
    const current = this.orderRepository.findById(orderId);
    if (current?.status !== 'checkout') {
      return null;
    }
    if (current.payment && !current.payment.paymentId) {
      throw new DomainError('PAYMENT_IN_PROGRESS', 'A payment is in progress. Please wait for it to finish.');
    }
    const updated = this.orderRepository.transition(orderId, ['checkout'], { status: 'cancelled' });
    return updated ? this.orderService.toDTO(updated) : null;
  }

  private async cancelPaid(order: OrderRecord): Promise<OrderDTO> {
    const { orderId, status } = order;
    if (status !== 'paid' && status !== 'processing') {
      throw new DomainError('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled');
    }

    // Claimed in one synchronous step: the worker no longer moves the order
    const claimed = this.orderRepository.transition(orderId, [status], { cancelRequested: true });
    if (!claimed) {
      // The worker finished the order first: only one transition applies (AC-5.6)
      throw new DomainError('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled');
    }

    // The order goes back to the worker unless the refund is in an unknown state
    let keepClaim = false;
    try {
      // Delivery is stopped before any money is returned, so a cancelled order is never shipped
      await this.stopDelivery(claimed);

      const payment = claimed.payment;
      const outcome: RefundOutcome = payment?.paymentId ? await this.refund(orderId, payment.paymentId, payment.amountUsd) : 'refunded';
      if (outcome === 'refunded') {
        return this.finishCancellation(orderId);
      }
      if (outcome === 'unknown') {
        keepClaim = true;
        throw new DomainError('REFUND_UNCONFIRMED', 'We are confirming the refund with the bank. The order will be cancelled shortly.');
      }
      throw new DomainError('REFUND_FAILED', 'The payment could not be refunded right now, so the order was not cancelled. Please try again.');
    } finally {
      if (!keepClaim) {
        this.releaseClaim(orderId);
      }
    }
  }

  private async stopDelivery(order: OrderRecord): Promise<void> {
    const job = order.status === 'processing' && order.fulfillment && !order.fulfillment.failed ? order.fulfillment : null;
    if (!job) {
      return;
    }

    const result = await this.callService(() => this.fulfillmentService.cancel(job.jobId), 'Fulfillment service');
    if (!result) {
      throw new DomainError('CANCEL_UNAVAILABLE', 'We could not cancel the order right now. Please try again.');
    }
    if (result.status === 'too_late') {
      throw new DomainError('ORDER_NOT_CANCELLABLE', 'The order has already been handed over for delivery');
    }
    // The stopped job is recorded as failed: if the refund fails, the user can retry processing or the cancellation
    this.orderRepository.transition(order.orderId, ['processing'], { fulfillment: { ...job, failed: true } });
  }

  private finishCancellation(orderId: string): OrderDTO {
    const current = this.orderRepository.findById(orderId);
    if (!current) {
      throw new DomainError('ORDER_NOT_FOUND', 'Order not found or access denied');
    }
    const payment: PaymentRecord | undefined = current.payment ? { ...current.payment, refunded: true } : undefined;
    const cancelled = this.orderRepository.transition(orderId, ['paid', 'processing'], {
      status: 'cancelled',
      cancelRequested: false,
      payment
    });
    return this.orderService.toDTO(cancelled ?? current);
  }

  private releaseClaim(orderId: string): void {
    const current = this.orderRepository.findById(orderId);
    if (current?.cancelRequested) {
      this.orderRepository.transition(orderId, [current.status], { cancelRequested: false });
    }
  }

  private async reconcile(order: OrderRecord): Promise<void> {
    const payment = order.payment;
    if (!payment?.paymentId) {
      this.finishCancellation(order.orderId);
      return;
    }

    const lookup = await this.callService(() => this.bankGateway.getPaymentByKey(payment.idempotencyKey), 'Bank');
    if (!lookup) {
      return;
    }
    if (lookup.status === 'approved' && lookup.refunded) {
      this.finishCancellation(order.orderId);
      return;
    }
    // The refund did not happen: try it again with the same key
    const outcome = await this.refund(order.orderId, payment.paymentId, payment.amountUsd);
    if (outcome === 'refunded') {
      this.finishCancellation(order.orderId);
    } else if (outcome === 'declined') {
      console.error('Refund for a cancellation declined; order released', { orderId: order.orderId });
      this.releaseClaim(order.orderId);
    }
  }

  // The same refund key for a payment: a repeated refund never returns the money twice
  private async refund(orderId: string, paymentId: string, amountUsd: number): Promise<RefundOutcome> {
    try {
      const result = await withTimeout(
        this.bankGateway.refund({ paymentId, amountUsd, idempotencyKey: refundKey(paymentId) }),
        this.timeoutMs,
        'Bank'
      );
      if (result.status === 'refunded') {
        console.warn('Payment refunded', { orderId, paymentId });
        return 'refunded';
      }
      console.error('Refund declined by the bank', { orderId, paymentId });
      return 'declined';
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        console.warn('Bank did not answer a refund', { orderId, paymentId });
        return 'unknown';
      }
      // An unexpected bank error is treated as a failed refund; the user can try again
      console.error('Refund error', { orderId, paymentId, reason: error instanceof Error ? error.name : 'unknown' });
      return 'declined';
    }
  }

  // An outage returns null; any other error is a bug and propagates
  private async callService<T>(call: () => Promise<T>, service: string): Promise<T | null> {
    try {
      return await withTimeout(call(), this.timeoutMs, service);
    } catch (error) {
      if (error instanceof IntegrationUnavailableError) {
        return null;
      }
      throw error;
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
