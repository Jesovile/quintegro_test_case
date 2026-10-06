import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';

export class WebhookController {
  constructor(private paymentService: PaymentService) {}

  async handlePaymentWebhook(req: Request, res: Response) {
    try {
      const { paymentId } = req.body;
      if (!paymentId || typeof paymentId !== 'string') {
        return res.status(400).json({ error: 'paymentId is required' });
      }

      const result = await this.paymentService.handleWebhook(paymentId);
      return res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('Payment webhook error:', err);
      return res.status(500).json({ error: message });
    }
  }
}
