import { IOrderRepository, IBankService, CardData } from '../repositories/interfaces';
import { OrderStatusService } from './orderStatusService';

export class PaymentService {
  constructor(
    private orderRepository: IOrderRepository,
    private bankService: IBankService,
    private orderStatusService: OrderStatusService,
  ) {}

  private async process(paymentId: string, cardData?: CardData): Promise<{ orderId: string; status: string }> {
    const order = this.orderRepository.findByPaymentId(paymentId);
    if (!order) throw new Error(`No order found for paymentId: ${paymentId}`);

    if (order.status !== 'waitingPayment') {
      return { orderId: order.orderId, status: order.status };
    }

    const result = this.bankService.processPayment(paymentId, cardData);

    if (result.success) {
      const inProcess = this.orderStatusService.transition(order, 'paymentProcess');
      const inProgress = this.orderStatusService.transition(inProcess, 'inProgress');
      this.orderRepository.update(inProgress);
      return { orderId: order.orderId, status: 'inProgress' };
    }

    const failed = this.orderStatusService.transition(order, 'failed');
    this.orderRepository.update(failed);
    return { orderId: order.orderId, status: result.errorCode ?? 'failed' };
  }

  async pay(paymentId: string, cardData: CardData): Promise<{ orderId: string; status: string }> {
    return this.process(paymentId, cardData);
  }

  async handleWebhook(paymentId: string): Promise<{ orderId: string; status: string }> {
    return this.process(paymentId);
  }
}
