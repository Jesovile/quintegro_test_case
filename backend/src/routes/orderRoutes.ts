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
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/OrderDTO'
   *       403:
   *         description: Forbidden - Invalid or missing authentication token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Invalid or missing authentication token"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
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
   *         description: Unique identifier of the order
   *         example: "order-1"
   *     responses:
   *       200:
   *         description: Order details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OrderDTO'
   *       403:
   *         description: Forbidden - Invalid token or user is not owner of the order
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Invalid or missing authentication token"
   *       404:
   *         description: Order not found or access denied
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Order not found or access denied"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  router.get('/:orderId', (req, res) => orderController.getOrderById(req, res));

  /**
   * @swagger
   * /order/{orderId}/{productId}:
   *   delete:
   *     summary: Delete a product from an order
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique identifier of the order
   *         example: "order-1"
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique identifier of the product to delete
   *         example: "product-1"
   *     responses:
   *       200:
   *         description: Product deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OrderDTO'
   *       400:
   *         description: Bad request - Missing order ID or product ID
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Order ID and Product ID are required"
   *       403:
   *         description: Forbidden - Invalid authentication token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Invalid or missing authentication token"
   *       404:
   *         description: Order not found or access denied
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Order not found or access denied"
   *       409:
   *         description: Order can no longer be changed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "This order can no longer be changed"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  router.delete('/:orderId/:productId', (req, res) => orderController.deleteProductFromOrder(req, res));

  return router;
}
