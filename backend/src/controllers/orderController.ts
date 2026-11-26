import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { AuthService } from '../services/authService';
import { OrderSumRequestDTO } from '../types/dtos';
import { CheckoutErrorCode } from '../types/enums';
import { CheckoutError } from '../errors/checkoutError';
import { checkoutSuccess, checkoutFailure } from '../mappers/checkoutMapper';

const submissionStatus: Record<CheckoutErrorCode, number> = {
  [CheckoutErrorCode.AUTHENTICATION_REQUIRED]: 403,
  [CheckoutErrorCode.ORDER_NOT_FOUND]: 404,
  [CheckoutErrorCode.INVALID_ORDER_STATUS]: 409,
  [CheckoutErrorCode.ORDER_PROCESSING]: 409,
  [CheckoutErrorCode.VALIDATION_ERROR]: 400,
  [CheckoutErrorCode.INVALID_ORDER_TOTAL]: 400,
  [CheckoutErrorCode.PAYMENT_DECLINED]: 402,
  [CheckoutErrorCode.PAYMENT_PROVIDER_ERROR]: 502,
  [CheckoutErrorCode.INTERNAL_ERROR]: 500
};

export class OrderController {
  constructor(
    private orderService: OrderService,
    private authService: AuthService
  ) {}

  private extractUserIdFromToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = this.authService.verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  }

  async getOrders(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const orders = await this.orderService.getOrdersByUserId(userId);
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId } = req.params;
      const order = await this.orderService.getOrderById(orderId, userId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found or access denied' });
      }

      return res.status(200).json(order);
    } catch (error) {
      console.error('Get order by id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async calculateOrderSum(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId } = req.params;
      const { products, promo } = req.body as OrderSumRequestDTO;

      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'Products array is required' });
      }

      // Validate products structure
      for (const product of products) {
        if (!product.id || typeof product.amount !== 'number' || typeof product.price !== 'number') {
          return res.status(400).json({ error: 'Invalid product structure. Each product must have id, amount, and price' });
        }
        if (product.amount < 0 || product.price < 0) {
          return res.status(400).json({ error: 'Amount and price must be non-negative' });
        }
      }

      const sum = this.orderService.calculateOrderSum(products, promo);
      return res.status(200).json(sum);
    } catch (error) {
      console.error('Calculate order sum error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteProductFromOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId, productId } = req.params;

      if (!orderId || !productId) {
        return res.status(400).json({ error: 'Order ID and Product ID are required' });
      }

      const updatedOrder = await this.orderService.deleteProductFromOrder(orderId, productId, userId);

      if (!updatedOrder) {
        return res.status(404).json({ error: 'Order not found or access denied' });
      }

      return res.status(200).json(updatedOrder);
    } catch (error) {
      console.error('Delete product from order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async submitOrder(req: Request, res: Response) {
    const { orderId } = req.params;
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        throw new CheckoutError(CheckoutErrorCode.AUTHENTICATION_REQUIRED, 'Authentication required');
      }

      const result = await this.orderService.submitOrder(orderId, userId, req.body);
      return res.status(200).json(checkoutSuccess(result));
    } catch (error) {
      const failure = checkoutFailure(error, orderId);
      return res.status(submissionStatus[failure.code]).json(failure);
    }
  }
}
