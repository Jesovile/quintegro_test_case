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
   *         description: Unique identifier of the order
   *         example: "order-1"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - products
   *             properties:
   *               products:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - id
   *                     - amount
   *                     - price
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Product ID
   *                       example: "product-1"
   *                     amount:
   *                       type: number
   *                       minimum: 0
   *                       description: Product quantity
   *                       example: 2
   *                     price:
   *                       type: number
   *                       minimum: 0
   *                       description: Product price
   *                       example: 1299.99
   *               promo:
   *                 type: string
   *                 description: Optional promo code to apply discount
   *                 example: "SAVE10"
   *     responses:
   *       200:
   *         description: Order sum calculated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: number
   *               description: Total sum of the order
   *               example: 2599.98
   *       400:
   *         description: Bad request - Invalid products data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Products array is required"
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
  router.post('/:orderId/sum', (req, res) => orderController.calculateOrderSum(req, res));

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

  /**
   * @swagger
   * /order/{orderId}/checkout/start:
   *   post:
   *     summary: Move order into checkout state
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Order in checkout state
   *       403: { description: Invalid token }
   *       404: { description: Order not found }
   *       409: { description: Invalid status transition }
   */
  router.post('/:orderId/checkout/start', (req, res) => orderController.startCheckout(req, res));

  /**
   * @swagger
   * /order/{orderId}/checkout:
   *   patch:
   *     summary: Update checkout draft (shipping)
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [shipping]
   *             properties:
   *               shipping:
   *                 type: object
   *                 required: [fullName, address, city, zip, country, phone]
   *                 properties:
   *                   fullName: { type: string }
   *                   address: { type: string }
   *                   city: { type: string }
   *                   zip: { type: string }
   *                   country: { type: string }
   *                   phone: { type: string }
   *     responses:
   *       200: { description: Checkout updated }
   *       400: { description: Invalid or missing shipping }
   *       403: { description: Invalid token }
   *       404: { description: Order not found }
   *       409: { description: Order not in checkout state }
   */
  router.patch('/:orderId/checkout', (req, res) => orderController.updateCheckout(req, res));

  /**
   * @swagger
   * /order/{orderId}/checkout/place:
   *   post:
   *     summary: Charge card and place the order
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [card]
   *             properties:
   *               card:
   *                 type: object
   *                 required: [number, holderName, expiryMonth, expiryYear, cvv]
   *                 properties:
   *                   number: { type: string }
   *                   holderName: { type: string }
   *                   expiryMonth: { type: integer }
   *                   expiryYear: { type: integer }
   *                   cvv: { type: string }
   *     responses:
   *       200: { description: Order placed }
   *       400: { description: Invalid card or shipping }
   *       402: { description: Payment declined }
   *       403: { description: Invalid token }
   *       404: { description: Order not found }
   *       409: { description: Order not in checkout state }
   */
  router.post('/:orderId/checkout/place', (req, res) => orderController.placeOrder(req, res));

  /**
   * @swagger
   * /order/{orderId}/checkout/cancel:
   *   post:
   *     summary: Cancel order (terminal)
   *     tags: [Checkout]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: orderId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200: { description: Order canceled }
   *       403: { description: Invalid token }
   *       404: { description: Order not found }
   *       409: { description: Order cannot be canceled in current state }
   */
  router.post('/:orderId/checkout/cancel', (req, res) => orderController.cancelCheckout(req, res));

  /**
   * @swagger
   * /order/{orderId}:
   *   post:
   *     summary: Submit an order (change status to 'submited')
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
   *         description: Order submitted successfully
   *       400:
   *         description: Bad request - Missing order ID
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Order ID is required"
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
  router.post('/:orderId', (req, res) => orderController.submitOrder(req, res));

  return router;
}
