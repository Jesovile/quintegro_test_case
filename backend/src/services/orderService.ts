import { OrderRecord, OrderDTO, ProductRecord, PromoEntity, DeliveryAddress, DeliveryMethodType } from '../types/entities';
import { IOrderRepository, IProductRepository, IPromoRepository, IDeliveryMethodRepository } from '../repositories/interfaces';
// Type-only import — PaymentService.ts imports OrderService as a value (its
// constructor dependency), so a value-level import back here would create a
// circular runtime require(). We only need PaymentService's shape for the
// optional field below; `import type` is erased at compile time, so the
// circularity never materializes at runtime. Wiring the actual instance
// together happens one level up, in app.ts, via setPaymentService() —
// see tech-design.md §2.4 / implementation-plan-05.md's note on the
// PaymentService<->OrderService cross-service dependency (feature 4 gap
// closed here in feature 5).
import type { PaymentService } from './paymentService';

export class OrderService {
  private paymentService?: PaymentService;

  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository,
    private deliveryMethodRepository: IDeliveryMethodRepository
  ) {}

  // Setter injection (not constructor injection) is deliberate: PaymentService
  // already takes OrderService as a constructor dependency (feature 4), so
  // OrderService taking PaymentService in its own constructor would be
  // circular. Called once from app.ts right after both services are
  // constructed.
  setPaymentService(paymentService: PaymentService): void {
    this.paymentService = paymentService;
  }

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

  async getCurrentCart(userId: string): Promise<OrderDTO | null> {
    const orders = this.orderRepository.findByUserId(userId);
    const currentCart = orders.find(order => order.status === 'created');

    if (!currentCart) {
      return null;
    }

    return this.transformToDTO(currentCart);
  }

  async setDeliveryDetails(
    orderId: string,
    userId: string,
    address: DeliveryAddress,
    methodType: DeliveryMethodType
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    if (order.status !== 'created') {
      return null;
    }

    const methodOption = this.deliveryMethodRepository.findByType(methodType);
    if (!methodOption) {
      return null;
    }

    const updatedOrder: OrderRecord = {
      ...order,
      deliveryAddress: address,
      deliveryMethod: {
        type: methodOption.type,
        fee: methodOption.fee,
        estimatedDays: methodOption.estimatedDays
      }
    };

    this.updateOrder(updatedOrder);

    return this.transformToDTO(updatedOrder);
  }

  // tech-design.md §2.4/§3.3, implementation-plan-06.md iteration 6.3 —
  // ownership + 'paid' status check; only a 'paid' order can be cancelled.
  // Returns null for not-found/not-owned (resolver turns this into
  // 'Order not found or access denied'); throws a distinct error for a
  // wrong-status attempt so the frontend can distinguish the two (AC-601-4).
  async cancelOrder(orderId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    if (order.status !== 'paid') {
      throw new Error('Order cannot be cancelled in its current status');
    }

    const updatedOrder: OrderRecord = {
      ...order,
      status: 'cancelled',
      cancelledAt: Date.now()
    };

    this.updateOrder(updatedOrder);

    return this.transformToDTO(updatedOrder);
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

  // Server-side, single source of truth for the checkout review/payment total
  // (tech-design.md §4.3). Wraps calculateOrderSum (unchanged) + delivery fee.
  // Signature is frozen per plan-03's CRITICAL note: Feature 4's PaymentService.pay
  // must call this as calculateOrderTotal(order.products, order.promo?.id, order.deliveryMethod?.fee ?? 0)
  // — promoId is a string, never the full PromoEntity object.
  calculateOrderTotal(
    products: Array<{ id: string; amount: number; price: number }>,
    promoId: string | undefined,
    deliveryFee: number
  ): number {
    return this.calculateOrderSum(products, promoId) + deliveryFee;
  }

  async deleteProductFromOrder(orderId: string, productId: string, userId: string): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    // Mandatory security guard (tech-design.md §4.6 / implementation-plan-05
    // iteration 5.1): without this check, any authenticated user could edit a
    // paid/cancelled order's line items via GraphQL Playground (both methods
    // funnel through here regardless of REST/GraphQL entry point) — closing
    // that gap is this feature's sole responsibility, do not duplicate.
    if (order.status !== 'created') {
      throw new Error('Order cannot be modified in its current status');
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

    // Mandatory security guard — see identical comment on
    // deleteProductFromOrder above (tech-design.md §4.6).
    if (order.status !== 'created') {
      throw new Error('Order cannot be modified in its current status');
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
        // Keep the first price encountered for the product — `existing` was
        // set from the first occurrence in `uniqueProducts.set` below, so its
        // price must never be overwritten by a later duplicate, including
        // when that first price is legitimately 0.
      } else {
        uniqueProducts.set(item.product.id, item);
      }
    });

    return {
      orderId: order.orderId,
      status: order.status,
      products: Array.from(uniqueProducts.values()),
      promo: order.promo,
      deliveryAddress: order.deliveryAddress,
      deliveryMethod: order.deliveryMethod,
      // NEW (feature 5, closing the gap flagged by feature 4): projected via
      // PaymentService.getSummaryForOrder, wired in through setPaymentService
      // rather than a constructor dependency (see class-level comment above).
      // undefined (not set) if setPaymentService was never called, or if the
      // order has no payment attempts yet — both render as "no payment" on
      // the frontend, same as before this change.
      payment: this.paymentService?.getSummaryForOrder(order.orderId),
      total: this.calculateOrderTotal(order.products, order.promo?.id, order.deliveryMethod?.fee ?? 0),
      createAt: order.createAt
    };
  }
}
