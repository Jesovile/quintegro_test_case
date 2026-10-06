import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

export function createWebhookRoutes(webhookController: WebhookController): Router {
  const router = Router();

  /**
   * @swagger
   * /webhooks/payment:
   *   post:
   *     summary: Bank payment result webhook (mock — call after user "returns" from bank page)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [paymentId]
   *             properties:
   *               paymentId:
   *                 type: string
   *                 description: The paymentId returned by POST /order/:orderId/checkout
   *     responses:
   *       200:
   *         description: Payment processed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 orderId:
   *                   type: string
   *                 status:
   *                   type: string
   *                   enum: [inProgress, failed]
   *       400:
   *         description: Missing paymentId
   *       500:
   *         description: Payment not found or processing error
   */
  router.post('/payment', (req, res) => webhookController.handlePaymentWebhook(req, res));

  return router;
}
