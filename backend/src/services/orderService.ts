import { OrderRecord, OrderDTO, ProductRecord, ShippingInfo, CheckoutDraftInput } from '../types/entities';
import { IOrderRepository, IProductRepository, IPromoRepository } from '../repositories/interfaces';
import { PaymentProvider, ChargeRequest } from './paymentProvider';

export class LastProductError extends Error {
  constructor() {
    super('Cannot remove the last product from an order');
    this.name = 'LastProductError';
  }
}

export type CheckoutError =
  | 'ORDER_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_STATUS'
  | 'INVALID_SHIPPING'
  | 'MISSING_SHIPPING'
  | 'PAYMENT_FAILED';

export interface CheckoutFailure {
  ok: false;
  error: CheckoutError;
  message?: string;
}

export interface CheckoutSuccess {
  ok: true;
  order: OrderDTO;
}

export type CheckoutResult = CheckoutSuccess | CheckoutFailure;

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository,
    private paymentProvider: PaymentProvider
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

    const updatedProducts = order.products.filter(item => item.id !== productId);

    if (updatedProducts.length === order.products.length) {
      // productId was not in order
      return null;
    }

    if (updatedProducts.length === 0) {
      throw new LastProductError();
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

    // Check if order is in 'created' status
    if (order.status !== 'created') {
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

  async startCheckout(orderId: string, userId: string): Promise<CheckoutResult> {
    const order = this.orderRepository.findById(orderId);
    if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
    if (order.userId !== userId) return { ok: false, error: 'FORBIDDEN' };
    if (order.status !== 'created' && order.status !== 'checkout') {
      return { ok: false, error: 'INVALID_STATUS', message: `Order is ${order.status}` };
    }

    if (order.status === 'created') {
      const updated: OrderRecord = { ...order, status: 'checkout' };
      this.updateOrder(updated);
      return { ok: true, order: this.transformToDTO(updated) };
    }

    return { ok: true, order: this.transformToDTO(order) };
  }

  async updateCheckout(orderId: string, userId: string, draft: CheckoutDraftInput): Promise<CheckoutResult> {
    const order = this.orderRepository.findById(orderId);
    if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
    if (order.userId !== userId) return { ok: false, error: 'FORBIDDEN' };
    if (order.status !== 'checkout') return { ok: false, error: 'INVALID_STATUS' };

    if (draft.shipping && !this.isValidShipping(draft.shipping)) {
      return { ok: false, error: 'INVALID_SHIPPING' };
    }

    const updated: OrderRecord = {
      ...order,
      shipping: draft.shipping ?? order.shipping,
      payment: draft.payment ?? order.payment
    };
    this.updateOrder(updated);
    return { ok: true, order: this.transformToDTO(updated) };
  }

  async cancelCheckout(orderId: string, userId: string): Promise<CheckoutResult> {
    const order = this.orderRepository.findById(orderId);
    if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
    if (order.userId !== userId) return { ok: false, error: 'FORBIDDEN' };
    if (order.status !== 'checkout' && order.status !== 'created') {
      return { ok: false, error: 'INVALID_STATUS' };
    }

    const updated: OrderRecord = {
      ...order,
      status: 'canceled',
      canceledAt: Date.now()
    };
    this.updateOrder(updated);
    return { ok: true, order: this.transformToDTO(updated) };
  }

  async placeOrder(
    orderId: string,
    userId: string,
    card: ChargeRequest['card']
  ): Promise<CheckoutResult> {
    const order = this.orderRepository.findById(orderId);
    if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
    if (order.userId !== userId) return { ok: false, error: 'FORBIDDEN' };
    if (order.status !== 'checkout') return { ok: false, error: 'INVALID_STATUS' };
    if (!order.shipping || !this.isValidShipping(order.shipping)) {
      return { ok: false, error: 'MISSING_SHIPPING' };
    }

    const amount = this.calculateOrderSum(order.products);
    const charge = await this.paymentProvider.charge({
      amount,
      currency: 'USD',
      card
    });

    if (!charge.ok) {
      return { ok: false, error: 'PAYMENT_FAILED', message: charge.error };
    }

    const digits = card.number.replace(/\s+/g, '');
    const updated: OrderRecord = {
      ...order,
      status: 'submited',
      placedAt: Date.now(),
      payment: {
        brand: this.detectBrand(digits),
        last4: digits.slice(-4),
        holderName: card.holderName
      }
    };
    this.updateOrder(updated);
    return { ok: true, order: this.transformToDTO(updated) };
  }

  private isValidShipping(s: ShippingInfo): boolean {
    return Boolean(
      s.fullName?.trim() &&
      s.address?.trim() &&
      s.city?.trim() &&
      s.zip?.trim() &&
      s.country?.trim() &&
      s.phone?.trim()
    );
  }

  private detectBrand(digits: string): string {
    if (/^4/.test(digits)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
    if (/^3[47]/.test(digits)) return 'amex';
    if (/^6(?:011|5)/.test(digits)) return 'discover';
    return 'card';
  }

  private updateOrder(updatedOrder: OrderRecord): void {
    this.orderRepository.update(updatedOrder);
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
      createAt: order.createAt,
      placedAt: order.placedAt,
      canceledAt: order.canceledAt,
      products: Array.from(uniqueProducts.values()),
      promo: order.promo,
      shipping: order.shipping,
      payment: order.payment
    };
  }
}
