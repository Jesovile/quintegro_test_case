import { OrderRecord, OrderDTO, ProductRecord } from '../types/entities';
import { IOrderRepository, IProductRepository } from '../repositories/interfaces';

export class OrderQueryService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
  ) {}

  async getOrdersByUserId(userId: string): Promise<OrderDTO[]> {
    return this.orderRepository.findByUserId(userId).map(o => this.toDTO(o));
  }

  async getOrderById(orderId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) return null;
    return this.toDTO(order);
  }

  toDTO(order: OrderRecord): OrderDTO {
    const unique = new Map<string, { product: ProductRecord; amount: number; price: number }>();

    for (const item of order.products) {
      const product = this.productRepository.findById(item.id);
      if (!product) throw new Error(`Product ${item.id} not found`);

      const amount = Math.max(1, Math.min(10, item.amount));
      const existing = unique.get(item.id);
      if (existing) {
        existing.amount = Math.min(10, existing.amount + amount);
      } else {
        unique.set(item.id, { product, amount, price: item.price });
      }
    }

    return {
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt,
      products: Array.from(unique.values()),
      promo: order.promo,
      checkoutData: order.checkoutData,
      paymentId: order.paymentId,
      paymentUrl: order.paymentUrl,
    };
  }
}
