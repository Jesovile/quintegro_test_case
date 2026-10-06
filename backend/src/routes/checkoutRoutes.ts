import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';

export function createCheckoutRoutes(checkoutController: CheckoutController): Router {
  const router = Router();

  /**
   * @swagger
   * /order/{orderId}/checkout:
   *   post:
   *     summary: Initiate checkout for an order
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [address, phone, deliveryAt]
   *             properties:
   *               address:
   *                 type: string
   *                 example: "123 Main St, New York, NY 10001"
   *               phone:
   *                 type: string
   *                 example: "+19991234567"
   *               deliveryAt:
   *                 type: string
   *                 format: date-time
   *                 example: "2026-11-01T12:00:00.000Z"
   *               comment:
   *                 type: string
   *     responses:
   *       200:
   *         description: Payment session created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 paymentId:
   *                   type: string
   *                 paymentUrl:
   *                   type: string
   *       400:
   *         description: Validation error
   *       403:
   *         description: Authentication required
   *       409:
   *         description: Order is not in 'new' status
   */
  router.post('/:orderId/checkout', (req, res) => checkoutController.checkout(req, res));

  /**
   * @swagger
   * /order/{orderId}/cancel:
   *   post:
   *     summary: Cancel an order (user-initiated, only from 'new' or 'waitingPayment')
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order cancelled
   *       403:
   *         description: Authentication required
   *       409:
   *         description: Order cannot be cancelled from its current status
   */
  router.post('/:orderId/cancel', (req, res) => checkoutController.cancelOrder(req, res));

  return router;
}
