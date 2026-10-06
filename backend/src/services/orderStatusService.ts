import { OrderRecord, OrderStatus } from '../types/entities';

const ALLOWED_TRANSITIONS = new Map<OrderStatus, OrderStatus[]>([
  ['new',            ['waitingPayment', 'canceledByUser']],
  ['waitingPayment', ['paymentProcess', 'failed', 'canceledByUser', 'canceledByCompany']],
  ['paymentProcess', ['inProgress', 'failed', 'canceledByCompany']],
  ['inProgress',     ['delivery', 'failed', 'canceledByCompany']],
  ['delivery',       ['done', 'failed', 'canceledByCompany']],
]);

export class OrderStatusService {
  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return (ALLOWED_TRANSITIONS.get(from) ?? []).includes(to);
  }

  transition(order: OrderRecord, to: OrderStatus): OrderRecord {
    if (!this.canTransition(order.status, to)) {
      throw new Error(`Invalid status transition: ${order.status} → ${to}`);
    }
    return { ...order, status: to, updatedAt: Date.now() };
  }
}
