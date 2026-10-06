import { CheckoutData } from '../types/entities';
import { IOrderRepository, IPromoRepository, IBankService } from '../repositories/interfaces';
import { OrderStatusService } from './orderStatusService';
import { PricingService } from './pricingService';

export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface CheckoutResult {
  paymentId: string;
  paymentUrl: string;
}

export class CheckoutService {
  constructor(
    private orderRepository: IOrderRepository,
    private promoRepository: IPromoRepository,
    private pricingService: PricingService,
    private bankService: IBankService,
    private orderStatusService: OrderStatusService,
  ) {}
  // Добавить uow сюда, чтобы в случае ошибки между сервисами, откатывать транзакциюю
  async checkout(orderId: string, userId: string, checkoutData: CheckoutData): Promise<CheckoutResult> {
    const order = this.orderRepository.findById(orderId);

    // подумать над тем куда вынести в отдельный сервис
    if (!order) throw new CheckoutError('ORDER_NOT_FOUND', 'Order not found');
    if (order.userId !== userId) throw new CheckoutError('ACCESS_DENIED', 'Access denied');
    if (order.status !== 'new')
      throw new CheckoutError('INVALID_STATUS', `Order cannot be checked out from status '${order.status}'`);
    if (order.products.length === 0) throw new CheckoutError('EMPTY_CART', 'Cannot checkout an empty cart');

    // Убрать промоакции
    if (order.promo) {
      const promo = this.promoRepository.findById(order.promo.id);
      if (!promo || Date.now() > promo.dueDate) {
        throw new CheckoutError('PROMO_EXPIRED', 'Applied promo code has expired');
      }
    }

    const total = this.pricingService.calculateOrderSum(order.products, order.promo?.id);
    const session = this.bankService.initiatePayment(orderId, total);

    const updated = this.orderStatusService.transition(
      { ...order, checkoutData, paymentId: session.paymentId, paymentUrl: session.paymentUrl, paymentInitiatedAt: Date.now() },
      'waitingPayment',
    );

    this.orderRepository.update(updated);

    return { paymentId: session.paymentId, paymentUrl: session.paymentUrl };
  }

  async cancelOrder(orderId: string, userId: string): Promise<void> {
    const order = this.orderRepository.findById(orderId);
    if (!order) throw new CheckoutError('ORDER_NOT_FOUND', 'Order not found');
    if (order.userId !== userId) throw new CheckoutError('ACCESS_DENIED', 'Access denied');

    const updated = this.orderStatusService.transition(order, 'canceledByUser');
    this.orderRepository.update(updated);
  }
}
