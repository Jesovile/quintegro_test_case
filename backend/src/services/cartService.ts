import { OrderDTO, OrderRecord } from '../types/entities';
import { IOrderRepository } from '../repositories/interfaces';
import { OrderQueryService } from './orderQueryService';

export class CartService {
  constructor(
    private orderRepository: IOrderRepository,
    private orderQueryService: OrderQueryService,
  ) {}

  async deleteProductFromOrder(orderId: string, productId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) return null;
    if (order.status !== 'new') return null;

    const updatedProducts = order.products.filter(p => p.id !== productId);
    if (updatedProducts.length === 0) return null;

    this.orderRepository.update({ ...order, products: updatedProducts, updatedAt: Date.now() });
    return this.orderQueryService.getOrderById(orderId, userId);
  }

  async updateProductAmount(orderId: string, productId: string, newAmount: number, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) return null;
    if (order.status !== 'new') return null;

    const updatedProducts = order.products.map(p =>
      p.id === productId ? { ...p, amount: Math.max(1, Math.min(10, newAmount)) } : p
    );

    this.orderRepository.update({ ...order, products: updatedProducts, updatedAt: Date.now() });
    return this.orderQueryService.getOrderById(orderId, userId);
  }

  async createOrder(userId: string): Promise<OrderDTO> {
    const now = Date.now();
    const newOrder: OrderRecord = {
      orderId: `order-${now}`,
      userId,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      products: [],
    };
    this.orderRepository.save(newOrder);
    return this.orderQueryService.toDTO(newOrder);
  }
}
