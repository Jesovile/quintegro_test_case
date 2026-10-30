import { OrderRecord, OrderDTO, ProductRecord } from '../types/entities';
import { IOrderRepository, IProductRepository } from '../repositories/interfaces';
import { DomainError } from '../errors/domainError';
import { calculateOrderTotals } from './pricing';

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository
  ) {}

  async getOrdersByUserId(userId: string): Promise<OrderDTO[]> {
    const orders = this.orderRepository.findByUserId(userId);
    return orders.map(order => this.transformToDTO(order));
  }

  async getOrderById(orderId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    
    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    return this.transformToDTO(order);
  }

  async deleteProductFromOrder(orderId: string, productId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    
    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    this.assertEditable(order);

    // Remove the product from the order
    const updatedProducts = order.products.filter(item => item.id !== productId);

    // Create updated order record
    const updatedOrder: OrderRecord = {
      ...order,
      products: updatedProducts
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);

    // Transform to DTO and return
    return this.transformToDTO(updatedOrder);
  }

  async updateProductAmount(orderId: string, productId: string, newAmount: number, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    
    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    this.assertEditable(order);

    // Update the product amount
    const updatedProducts = order.products.map(item => 
      item.id === productId 
        ? { ...item, amount: Math.max(1, Math.min(10, newAmount)) }
        : item
    );

    // Create updated order record
    const updatedOrder: OrderRecord = {
      ...order,
      products: updatedProducts
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);

    // Transform to DTO and return
    return this.transformToDTO(updatedOrder);
  }

  private assertEditable(order: OrderRecord): void {
    if (order.status !== 'created') {
      throw new DomainError('ORDER_NOT_EDITABLE', 'This order can no longer be changed');
    }
  }

  private updateOrder(updatedOrder: OrderRecord): void {
    // Update the order in the in-memory repository
    // This method should be called whenever order state changes
    this.orderRepository.update(updatedOrder);
  }

  private transformToDTO(order: OrderRecord): OrderDTO {
    const products = order.products.map(item => {
      // A product removed from the catalog must not break the order: its position still counts in totals
      const product = this.productRepository.findById(item.id) ?? {
        id: item.id,
        title: 'Unavailable product',
        description: '',
        image: ''
      };

      return {
        product,
        amount: Math.max(1, Math.min(10, item.amount)), // Ensure amount is between 1-10
        price: item.price
      };
    });

    // Remove duplicates and sum amounts for same products
    const uniqueProducts = new Map<string, { product: ProductRecord; amount: number; price: number }>();
    
    products.forEach(item => {
      const existing = uniqueProducts.get(item.product.id);
      if (existing) {
        existing.amount = Math.min(10, existing.amount + item.amount);
        // Keep the first price encountered for the product
        if (!existing.price) {
          existing.price = item.price;
        }
      } else {
        uniqueProducts.set(item.product.id, item);
      }
    });

    const orderProducts = Array.from(uniqueProducts.values());

    return {
      orderId: order.orderId,
      status: order.status,
      products: orderProducts,
      totals: calculateOrderTotals(orderProducts, order.promo?.discount)
    };
  }
}
