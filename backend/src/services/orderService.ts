import {
  OrderRecord,
  OrderDTO,
  ProductRecord,
  PromoEntity,
  Address,
  CheckoutInput,
  SubmitOrderResult,
  PaymentInput,
  PayOrderResult
} from '../types/entities';
import { IOrderRepository, IProductRepository, IPromoRepository } from '../repositories/interfaces';

// Mocked payment "test decline number": submitting this exact card number to
// payOrder always fails; any other syntactically-valid card number succeeds.
// Documented in backend/README.md as well.
const TEST_DECLINE_CARD_NUMBER = '4000000000000002';

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

  async submitOrder(orderId: string, userId: string, input: CheckoutInput): Promise<SubmitOrderResult> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return { success: false, error: 'Order not found or access denied' };
    }

    if (order.userId !== userId) {
      return { success: false, error: 'Order not found or access denied' };
    }

    // Check if order is in 'created' status
    if (order.status !== 'created') {
      return { success: false, error: 'Order is not in created status' };
    }

    const validationError = this.validateCheckoutInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // billing omitted/null on the input means "same as shipping" — copy the
    // shipping address across rather than leaving billingAddress unset.
    const billingAddress: Address = input.billing ? { ...input.billing } : { ...input.shipping };

    const updatedOrder: OrderRecord = {
      ...order,
      status: 'submitted',
      recipientName: input.recipientName,
      shippingAddress: { ...input.shipping },
      billingAddress,
      comment: input.comment ?? undefined,
      paymentMethodId: input.paymentMethodId
    };

    this.updateOrder(updatedOrder);
    return { success: true, order: this.transformToDTO(updatedOrder) };
  }

  private validateCheckoutInput(input: CheckoutInput): string | null {
    const isNonEmpty = (value: string | undefined | null): boolean => !!value && value.trim().length > 0;

    if (!isNonEmpty(input.recipientName)) {
      return 'Recipient name is required';
    }

    if (!this.isAddressComplete(input.shipping)) {
      return 'All shipping address fields are required';
    }

    // Only validate billing fields when a distinct billing address was supplied.
    if (input.billing && !this.isAddressComplete(input.billing)) {
      return 'All billing address fields are required';
    }

    if (!isNonEmpty(input.paymentMethodId)) {
      return 'Payment method is required';
    }

    return null;
  }

  private isAddressComplete(address: Address): boolean {
    const isNonEmpty = (value: string | undefined | null): boolean => !!value && value.trim().length > 0;
    return (
      isNonEmpty(address.country) &&
      isNonEmpty(address.city) &&
      isNonEmpty(address.streetAndHouseNumber) &&
      isNonEmpty(address.postalCode) &&
      isNonEmpty(address.phone)
    );
  }

  async payOrder(orderId: string, userId: string, input?: PaymentInput | null): Promise<PayOrderResult> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error('Order not found or access denied');
    }

    if (order.userId !== userId) {
      throw new Error('Order not found or access denied');
    }

    // Payment can only be attempted on an order that has completed checkout
    // and not already been paid/cancelled/etc.
    if (order.status !== 'submitted') {
      throw new Error('Order is not awaiting payment');
    }

    // Card number/CVC are read only to decide success/decline below — they
    // are never written to the repository (no real cardholder data persisted).
    const isDeclined = order.paymentMethodId === 'card' && input?.cardNumber === TEST_DECLINE_CARD_NUMBER;

    if (isDeclined) {
      // Status stays 'submitted' so the buyer can retry.
      return { success: false, error: 'Payment declined', order: this.transformToDTO(order) };
    }

    const updatedOrder: OrderRecord = {
      ...order,
      status: 'paid'
    };

    this.updateOrder(updatedOrder);
    return { success: true, order: this.transformToDTO(updatedOrder) };
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
      promo: order.promo,
      recipientName: order.recipientName,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      comment: order.comment,
      paymentMethodId: order.paymentMethodId
    };
  }
}
