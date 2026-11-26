import { randomUUID } from 'crypto';
import { CheckoutRecord, OrderRecord } from '../types/entities';
import { AcquiringResultDTO, CreditCardDTO, OrderDTO, OrderItemDTO, PaymentApprovalDTO, ProductInputDTO } from '../types/dtos';
import { CheckoutErrorCode } from '../types/enums';
import { CheckoutError } from '../errors/checkoutError';
import { IOrderRepository, IProductRepository, IPromoRepository, ICheckoutRepository } from '../repositories/interfaces';
import { IAcquiringService } from './interfaces';
import { validateCheckout } from './checkoutValidation';

export class OrderService {
  private processingOrders = new Set<string>();
  private paymentNamespace = randomUUID();

  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository,
    private checkoutRepository: ICheckoutRepository,
    private acquiringService: IAcquiringService
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

  calculateOrderSum(products: ProductInputDTO[], promoId?: string): number {
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

    if (order.status !== 'created' || this.processingOrders.has(orderId)) {
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

    if (order.status !== 'created' || this.processingOrders.has(orderId)) {
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

  async submitOrder(orderId: string, userId: string, input: unknown): Promise<CheckoutRecord> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new CheckoutError(CheckoutErrorCode.ORDER_NOT_FOUND, 'Order not found or access denied');
    }
    const previousCheckout = this.checkoutRepository.findByOrderId(orderId);
    if (previousCheckout && order.status === 'submited') {
      return previousCheckout;
    }
    if (order.status !== 'created') {
      throw new CheckoutError(CheckoutErrorCode.INVALID_ORDER_STATUS, 'Only created orders can be submitted');
    }
    if (this.processingOrders.has(orderId)) {
      throw new CheckoutError(CheckoutErrorCode.ORDER_PROCESSING, 'Payment for this order is already in progress');
    }
    const { customer, creditCard } = validateCheckout(input);
    const amount = this.calculatePaymentAmount(order);

    this.processingOrders.add(orderId);
    try {
      const payment = await this.acquirePayment(orderId, amount, creditCard);
      const checkout: CheckoutRecord = {
        ...customer, orderId, userId,
        paymentId: payment.paymentId,
        paymentProvider: payment.provider
      };
      // These synchronous in-memory writes cannot interleave with another request.
      this.checkoutRepository.save(checkout);
      this.updateOrder({ ...order, status: 'submited' });
      return checkout;
    } finally {
      this.processingOrders.delete(orderId);
    }
  }

  private async acquirePayment(orderId: string, amount: number, creditCard: CreditCardDTO): Promise<PaymentApprovalDTO> {
    let result: AcquiringResultDTO;
    try {
      result = await this.acquiringService.charge({
        orderId, amount, creditCard,
        idempotencyKey: `${this.paymentNamespace}:${orderId}`,
        currency: 'USD'
      });
    } catch {
      // Provider exceptions may contain card data. Discard them without logging.
      throw new CheckoutError(CheckoutErrorCode.PAYMENT_PROVIDER_ERROR, 'Payment provider is unavailable');
    }
    if (result?.status === 'declined') {
      throw new CheckoutError(CheckoutErrorCode.PAYMENT_DECLINED, 'Payment was declined');
    }
    if (result?.status !== 'approved' || typeof result.paymentId !== 'string' || !result.paymentId.trim()
      || typeof result.provider !== 'string' || !result.provider.trim()) {
      throw new CheckoutError(CheckoutErrorCode.PAYMENT_PROVIDER_ERROR, 'Payment provider is unavailable');
    }
    return result;
  }

  resetCheckout(): boolean {
    if (this.processingOrders.size > 0) return false;
    this.checkoutRepository.reset();
    this.paymentNamespace = randomUUID();
    return true;
  }

  private calculatePaymentAmount(order: OrderRecord): number {
    const invalidTotal = () => new CheckoutError(CheckoutErrorCode.INVALID_ORDER_TOTAL, 'Order must have a valid positive total');
    if (order.products.length === 0) throw invalidTotal();
    let subtotal = 0;
    for (const product of order.products) {
      const cents = Math.round(product.price * 100);
      if (!this.productRepository.findById(product.id)
        || !Number.isInteger(product.amount) || product.amount < 1 || product.amount > 10
        || !Number.isFinite(product.price) || product.price < 0
        || !Number.isSafeInteger(cents) || cents < 0) throw invalidTotal();
      subtotal += cents * product.amount;
      if (!Number.isSafeInteger(subtotal)) throw invalidTotal();
    }
    const promo = order.promo && this.promoRepository.findById(order.promo.id);
    if (promo && promo.dueDate >= Date.now()) {
      if (!Number.isFinite(promo.discount) || promo.discount < 0 || promo.discount > 100) throw invalidTotal();
      subtotal = Math.round(subtotal * (1 - promo.discount / 100));
    }
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) throw invalidTotal();
    return subtotal;
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
    const uniqueProducts = new Map<string, OrderItemDTO>();
    
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
      promo: order.promo,
      checkout: this.checkoutRepository.findByOrderId(order.orderId)
    };
  }
}
