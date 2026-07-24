import { PaymentMethod } from '../types/entities';

export class PaymentMethodService {
  private paymentMethods: PaymentMethod[] = [
    { id: 'card', label: 'Card' },
    { id: 'paypal', label: 'PayPal' },
    { id: 'klarna', label: 'Klarna' }
  ];

  getPaymentMethods(): PaymentMethod[] {
    return [...this.paymentMethods];
  }
}
