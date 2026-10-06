import { Request, Response } from 'express';
import { OrderQueryService } from '../services/orderQueryService';
import { CartService } from '../services/cartService';
import { PricingService } from '../services/pricingService';
import { AuthService } from '../services/authService';

interface ProductItem {
  id: string;
  amount: number;
  price: number;
}

interface OrderSumRequest {
  products: ProductItem[];
  promo?: string;
}

export class OrderController {
  constructor(
    private orderQueryService: OrderQueryService,
    private cartService: CartService,
    private pricingService: PricingService,
    private authService: AuthService,
  ) {}

  private extractUserId(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const decoded = this.authService.verifyToken(auth.substring(7));
    return decoded?.userId ?? null;
  }

  async getOrders(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const orders = await this.orderQueryService.getOrdersByUserId(userId);
      return res.status(200).json(orders);
    } catch (error) {
      console.error('Get orders error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId } = req.params;
      const order = await this.orderQueryService.getOrderById(orderId, userId);
      if (!order) return res.status(404).json({ error: 'Order not found or access denied' });

      return res.status(200).json(order);
    } catch (error) {
      console.error('Get order by id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async calculateOrderSum(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { products, promo } = req.body as OrderSumRequest;

      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'Products array is required' });
      }
      for (const p of products) {
        if (!p.id || typeof p.amount !== 'number' || typeof p.price !== 'number') {
          return res.status(400).json({ error: 'Invalid product structure: each product must have id, amount, and price' });
        }
        if (p.amount < 0 || p.price < 0) {
          return res.status(400).json({ error: 'Amount and price must be non-negative' });
        }
      }

      const sum = this.pricingService.calculateOrderSum(products, promo);
      return res.status(200).json(sum);
    } catch (error) {
      console.error('Calculate order sum error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const order = await this.cartService.createOrder(userId);
      return res.status(201).json(order);
    } catch (error) {
      console.error('Create order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteProductFromOrder(req: Request, res: Response) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) return res.status(403).json({ error: 'Invalid or missing authentication token' });

      const { orderId, productId } = req.params;
      if (!orderId || !productId) {
        return res.status(400).json({ error: 'Order ID and Product ID are required' });
      }

      const updatedOrder = await this.cartService.deleteProductFromOrder(orderId, productId, userId);
      if (!updatedOrder) return res.status(404).json({ error: 'Order not found or access denied' });

      return res.status(200).json(updatedOrder);
    } catch (error) {
      console.error('Delete product from order error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
