import { OrderRecord, OrderDTO, ProductRecord, PromoEntity } from '../types/entities';
import { IOrderRepository, IProductRepository, IPromoRepository } from '../repositories/interfaces';

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository
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

  calculateOrderSum(products: Array<{id: string, amount: number, price: number}>, promoId?: string): number {
    const subtotal = products.reduce((total, product) => {
      return total + (product.amount * product.price);
    }, 0);

    if (!promoId) {
      return subtotal;
    }

    // Validate promo
    const promo = this.promoRepository.findById(promoId);
    if (!promo) {
      return subtotal; // Return original sum if promo not found
    }

    // Check if promo is expired
    const currentTime = Date.now();
    if (currentTime > promo.dueDate) {
      return subtotal; // Return original sum if promo expired
    }

    // Apply discount
    const discount = (subtotal * promo.discount) / 100;
    return subtotal - discount;
  }

  async deleteProductFromOrder(orderId: string, productId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);
    
    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    // Remove the product from the order
    const updatedProducts = order.products.filter(item => item.id !== productId);
    
    // If no products left, return null (order would be empty)
    if (updatedProducts.length === 0) {
      return null;
    }

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

  async submitOrder(orderId: string, userId: string): Promise<boolean> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return false;
    }

    if (order.userId !== userId) {
      return false;
    }

    // Идемпотентность: повторный вызов после уже успешной отправки в сборку не должен падать.
    if (order.status === 'submited') {
      return true;
    }

    // Отправить в сборку можно только после успешной оплаты.
    if (order.status !== 'paid') {
      return false;
    }

    // Update order status to 'submited'
    const updatedOrder: OrderRecord = {
      ...order,
      status: 'submited'
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);
    return true;
  }

  private updateOrder(updatedOrder: OrderRecord): void {
    // Update the order in the in-memory repository
    // This method should be called whenever order state changes
    this.orderRepository.update(updatedOrder);
    console.log(`Order ${updatedOrder.orderId} updated in repository`);
  }

  private transformToDTO(order: OrderRecord): OrderDTO {
    const products = order.products.map(item => {
      const product = this.productRepository.findById(item.id);
      if (!product) {
        throw new Error(`Product with id ${item.id} not found`);
      }
      
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

    return {
      orderId: order.orderId,
      status: order.status,
      products: Array.from(uniqueProducts.values()),
      address: order.address,
      deliveryOption: order.deliveryOption,
      reservedUntil: order.reservedUntil
    };
  }
}
