import { Router } from 'express';
import { OrderController } from '../controllers/orderController';

export function createOrderRoutes(orderController: OrderController): Router {
  const router = Router();

  /**
   * @swagger
   * /order:
   *   get:
   *     summary: Get all orders for the authenticated user
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of user orders
   *       403:
   *         description: Invalid or missing authentication token
   */
  /**
   * @swagger
   * /order:
   *   post:
   *     summary: Create a new empty order
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Created order
   *       403:
   *         description: Authentication required
   */
  router.post('/', (req, res) => orderController.createOrder(req, res));

  router.get('/', (req, res) => orderController.getOrders(req, res));

  /**
   * @swagger
   * /order/{orderId}:
   *   get:
   *     summary: Get specific order by ID
   *     tags: [Orders]
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
   *         description: Order details
   *       403:
   *         description: Invalid token or access denied
   *       404:
   *         description: Order not found
   */
  router.get('/:orderId', (req, res) => orderController.getOrderById(req, res));

  /**
   * @swagger
   * /order/{orderId}/sum:
   *   post:
   *     summary: Calculate sum of an order
   *     tags: [Orders]
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
   *             required: [products]
   *             properties:
   *               products:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     amount:
   *                       type: number
   *                     price:
   *                       type: number
   *               promo:
   *                 type: string
   *     responses:
   *       200:
   *         description: Calculated order sum
   *       400:
   *         description: Invalid products data
   *       403:
   *         description: Invalid authentication token
   */
  router.post('/:orderId/sum', (req, res) => orderController.calculateOrderSum(req, res));

  /**
   * @swagger
   * /order/{orderId}/{productId}:
   *   delete:
   *     summary: Delete a product from an order (only when status is 'new')
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Updated order
   *       403:
   *         description: Invalid authentication token
   *       404:
   *         description: Order not found or access denied
   */
  router.delete('/:orderId/:productId', (req, res) => orderController.deleteProductFromOrder(req, res));

  return router;
}
