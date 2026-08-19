import { IPaymentProvider, ChargeRequest, ChargeResult } from './interfaces';

// Мок внешнего платёжного шлюза. Реальная интеграция (Stripe/YooKassa/PayPal SDK)
// подключается заменой тела charge() без изменения интерфейса или вызывающего кода.
export class MockPaymentProvider implements IPaymentProvider {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    // Эмуляция латентности внешнего шлюза, поверх уже имеющейся общей delayMiddleware.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (request.method === 'card' && request.card) {
      return this.chargeCard(request.card);
    }

    if (request.method === 'paypal' && request.paypal) {
      return this.chargePaypal(request.paypal.email);
    }

    return { success: false, errorCode: 'DECLINED', errorMessage: 'Некорректные платёжные данные.' };
  }

  private chargeCard(card: ChargeRequest['card']): ChargeResult {
    if (!card) {
      return { success: false, errorCode: 'DECLINED', errorMessage: 'Некорректные данные карты.' };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (card.expiryYear < currentYear || (card.expiryYear === currentYear && card.expiryMonth < currentMonth)) {
      return { success: false, errorCode: 'EXPIRED_CARD' };
    }

    const digits = card.cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return { success: false, errorCode: 'DECLINED', errorMessage: 'Неверный номер карты.' };
    }

    const last4 = digits.slice(-4);
    if (last4 === '0002') return { success: false, errorCode: 'DECLINED' };
    if (last4 === '0003') return { success: false, errorCode: 'INSUFFICIENT_FUNDS' };
    if (last4 === '0004') return { success: false, errorCode: 'GATEWAY_UNAVAILABLE' };

    return { success: true, transactionId: `mock_txn_${Date.now()}` };
  }

  private chargePaypal(rawEmail: string): ChargeResult {
    const email = rawEmail.toLowerCase();
    if (email.includes('decline')) return { success: false, errorCode: 'DECLINED' };
    if (email.includes('error')) return { success: false, errorCode: 'GATEWAY_UNAVAILABLE' };

    return { success: true, transactionId: `mock_txn_${Date.now()}` };
  }
}
