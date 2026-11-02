import { OrderDTO, OrderRecord, OrderStatus } from '../types/entities';
import { IOrderRepository } from '../repositories/interfaces';
import { DomainError } from '../errors/domainError';
import { OrderService } from './orderService';
import { canTransition } from './orderStateMachine';

export class CheckoutService {
  constructor(
    private orderRepository: IOrderRepository,
    private orderService: OrderService
  ) {}

  async startCheckout(orderId: string, userId: string): Promise<OrderDTO> {
    const order = this.findOwnOrder(orderId, userId);

    if (order.status === 'checkout') {
      return this.orderService.toDTO(order);
    }
    if (order.status === 'created' && order.products.length === 0) {
      throw new DomainError('ORDER_EMPTY', 'The order is empty');
    }

    return this.moveTo(order, 'checkout');
  }

  async exitCheckout(orderId: string, userId: string): Promise<OrderDTO> {
    const order = this.findOwnOrder(orderId, userId);

    if (order.status === 'created') {
      return this.orderService.toDTO(order);
    }

    return this.moveTo(order, 'created');
  }

  private findOwnOrder(orderId: string, userId: string): OrderRecord {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new DomainError('ORDER_NOT_FOUND', 'Order not found or access denied');
    }
    return order;
  }

  private moveTo(order: OrderRecord, to: OrderStatus): OrderDTO {
    const updated = canTransition(order.status, to)
      ? this.orderRepository.transition(order.orderId, [order.status], { status: to })
      : null;

    if (!updated) {
      throw new DomainError('INVALID_STATUS_TRANSITION', `The order cannot move to ${to}`);
    }
    return this.orderService.toDTO(updated);
  }
}
