import { CheckoutInput, CheckoutValidationResult, OrderRecord, OrderDTO, ProductRecord, PromoEntity } from '../types/entities';
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

    // Check if order is in 'created' status
    if (order.status !== 'created') {
      return false;
    }

    // The checkout flow starts after an order has been confirmed.
    const updatedOrder: OrderRecord = {
      ...order,
      status: 'waiting_payment'
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);
    return true;
  }

  processPayment(orderId: string, userId: string, input?: CheckoutInput | null): CheckoutValidationResult {
    const order = this.orderRepository.findById(orderId);

    if (!order || order.userId !== userId) {
      return {
        success: false,
        error: 'Order not found or access denied',
        errorCode: 'ORDER_NOT_FOUND'
      };
    }

    if (order.status !== 'waiting_payment' && order.status !== 'submited') {
      return {
        success: false,
        error: 'Order is not waiting for payment',
        errorCode: 'INVALID_ORDER_STATUS'
      };
    }

    if (!this.isDeliveryValid(input?.delivery)) {
      return {
        success: false,
        error: 'Postal code, street and city are required',
        errorCode: 'INVALID_DELIVERY'
      };
    }

    if (!input || !this.isPaymentValid(input.payment)) {
      return {
        success: false,
        error: input?.payment?.method === 'paypal'
          ? 'A valid PayPal email is required'
          : 'Use test card 4242 4242 4242 4242 with valid card details',
        errorCode: 'INVALID_PAYMENT'
      };
    }

    this.updateOrder({
      ...order,
      status: 'finished'
    });

    return { success: true };
  }

  private isDeliveryValid(delivery: CheckoutInput['delivery'] | undefined): boolean {
    return Boolean(
      delivery &&
      typeof delivery.postalCode === 'string' && delivery.postalCode.trim().length >= 3 &&
      typeof delivery.street === 'string' && delivery.street.trim().length >= 3 &&
      typeof delivery.city === 'string' && delivery.city.trim().length >= 2
    );
  }

  private isPaymentValid(payment: CheckoutInput['payment'] | undefined): boolean {
    if (!payment) {
      return false;
    }

    if (payment.method === 'paypal') {
      return typeof payment.paypalEmail === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payment.paypalEmail.trim());
    }

    if (payment.method !== 'card') {
      return false;
    }

    const cardNumber = typeof payment.cardNumber === 'string'
      ? payment.cardNumber.replace(/\D/g, '')
      : '';

    return cardNumber === '4242424242424242' &&
      typeof payment.cardholderName === 'string' && payment.cardholderName.trim().length >= 2 &&
      typeof payment.cvv === 'string' && /^\d{3,4}$/.test(payment.cvv) &&
      typeof payment.expiryDate === 'string' && this.isExpiryDateValid(payment.expiryDate);
  }

  private isExpiryDateValid(expiryDate: string): boolean {
    const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiryDate);
    if (!match) {
      return false;
    }

    const expiryMonth = Number(match[1]);
    const expiryYear = 2000 + Number(match[2]);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return expiryYear > currentYear || (expiryYear === currentYear && expiryMonth >= currentMonth);
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
      products: Array.from(uniqueProducts.values())
    };
  }
}
