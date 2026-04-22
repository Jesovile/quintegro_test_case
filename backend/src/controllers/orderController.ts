import { Request, Response } from 'express';
import { OrderService, CheckoutResult, CheckoutError } from '../services/orderService';
import { AuthService } from '../services/authService';
import { ShippingInfo } from '../types/entities';

interface ProductItem {
  id: string;
  amount: number;
  price: number;
}

interface OrderSumRequest {
  products: ProductItem[];
  promo?: string;
}

interface CardPayload {
  number: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
}

const ERROR_STATUS: Record<CheckoutError, number> = {
  ORDER_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_STATUS: 409,
  INVALID_SHIPPING: 400,
  MISSING_SHIPPING: 400,
  PAYMENT_FAILED: 402
};

function sendCheckoutResult(res: Response, result: CheckoutResult) {
  if (result.ok) {
    return res.status(200).json(result.order);
  }
  return res.status(ERROR_STATUS[result.error]).json({
    error: result.error,
    message: result.message
  });
}

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
      const { products, promo } = req.body as OrderSumRequest;

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

  async startCheckout(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId } = req.params;
      const result = await this.orderService.startCheckout(orderId, userId);
      return sendCheckoutResult(res, result);
    } catch (error) {
      console.error('Start checkout error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateCheckout(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId } = req.params;
      const { shipping } = req.body as { shipping?: ShippingInfo };

      if (!shipping) return res.status(400).json({ error: 'shipping is required' });

      const result = await this.orderService.updateCheckout(orderId, userId, { shipping });
      return sendCheckoutResult(res, result);
    } catch (error) {
      console.error('Update checkout error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async placeOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId } = req.params;
      const { card } = req.body as { card?: CardPayload };

      if (
        !card ||
        typeof card.number !== 'string' ||
        typeof card.holderName !== 'string' ||
        typeof card.expiryMonth !== 'number' ||
        typeof card.expiryYear !== 'number' ||
        typeof card.cvv !== 'string'
      ) {
        return res.status(400).json({ error: 'Invalid card payload' });
      }

      const result = await this.orderService.placeOrder(orderId, userId, card);
      return sendCheckoutResult(res, result);
    } catch (error) {
      console.error('Place order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async cancelCheckout(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId } = req.params;
      const result = await this.orderService.cancelCheckout(orderId, userId);
      return sendCheckoutResult(res, result);
    } catch (error) {
      console.error('Cancel checkout error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async submitOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserIdFromToken(req);
      
      if (!userId) {
        return res.status(403).json({ error: 'Invalid or missing authentication token' });
      }

      const { orderId } = req.params;

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }

      const success = await this.orderService.submitOrder(orderId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Order not found or access denied' });
      }

      return res.status(200).send();
    } catch (error) {
      console.error('Submit order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
