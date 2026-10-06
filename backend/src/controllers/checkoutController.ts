import { Request, Response } from 'express';
import { CheckoutService, CheckoutError } from '../services/checkoutService';
import { AuthService } from '../services/authService';
import { CheckoutData } from '../types/entities';

const CHECKOUT_ERROR_STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  ACCESS_DENIED: 403,
  INVALID_STATUS: 409,
  EMPTY_CART: 400,
  PROMO_EXPIRED: 400,
};

export class CheckoutController {
  constructor(
    private checkoutService: CheckoutService,
    private authService: AuthService,
  ) {}

  // Вынести в middlawere чтобы доступ к userId был проще
  private extractUserId(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const decoded = this.authService.verifyToken(auth.substring(7));
    return decoded?.userId ?? null;
  }

  async checkout(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Authentication required' });

      const { orderId } = req.params;
      // Переделываем валидацию на Zod и кастомые Error классы
      const { address, phone, deliveryAt, comment } = req.body;

      if (!address || typeof address !== 'string' || address.trim().length < 5) {
        return res.status(400).json({ error: 'Valid address is required (min 5 chars)' });
      }
      if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Valid phone number is required (10-15 digits)' });
      }
      if (!deliveryAt || isNaN(Date.parse(deliveryAt))) {
        return res.status(400).json({ error: 'deliveryAt must be a valid ISO date string' });
      }
      if (Date.parse(deliveryAt) <= Date.now()) {
        return res.status(400).json({ error: 'deliveryAt must be a future date' });
      }

      const checkoutData: CheckoutData = { address: address.trim(), phone, deliveryAt, comment };
      const result = await this.checkoutService.checkout(orderId, userId, checkoutData);

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof CheckoutError) {
        return res.status(CHECKOUT_ERROR_STATUS[err.code] ?? 400).json({ error: err.message, code: err.code });
      }
      console.error('Checkout error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Authentication required' });

      const { orderId } = req.params;
      await this.checkoutService.cancelOrder(orderId, userId);

      return res.status(200).json({ message: 'Order cancelled' });
    } catch (err) {
      if (err instanceof CheckoutError) {
        return res.status(CHECKOUT_ERROR_STATUS[err.code] ?? 400).json({ error: err.message, code: err.code });
      }
      console.error('Cancel order error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
