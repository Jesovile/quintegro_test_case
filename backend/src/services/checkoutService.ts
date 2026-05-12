import { ICheckoutRepository } from '../repositories/checkoutRepository';
import { IOrderRepository } from '../repositories/interfaces';

export class CheckoutService {
  constructor(
    private checkoutRepository: ICheckoutRepository,
    private orderRepository: IOrderRepository
  ) {}

  submitPaymentInfo(
    orderId: string,
    userId: string,
    info: { phone: string; address: string; email: string }
  ): { success: boolean; error?: string } {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      return { success: false, error: 'Order not found or access denied' };
    }

    if (!order.submitedAt) {
      return { success: false, error: 'Order has not been submitted yet' };
    }

    if (this.checkoutRepository.findByOrderId(orderId)) {
      return { success: false, error: 'Payment info already submitted for this order' };
    }

    const validationError = this.validatePaymentInfo(info);
    if (validationError) {
      return { success: false, error: validationError };
    }

    this.checkoutRepository.save({ orderId, ...info });
    return { success: true };
  }

  private validatePaymentInfo(info: { phone: string; address: string; email: string }): string | null {
    if (!info.phone || info.phone.trim().length < 7) {
      return 'Phone number must be at least 7 characters';
    }
    if (!info.address || info.address.trim().length < 5) {
      return 'Address must be at least 5 characters';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!info.email || !emailRegex.test(info.email)) {
      return 'Invalid email format';
    }
    return null;
  }
}
