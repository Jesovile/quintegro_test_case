import {
  OrderRecord,
  OrderDTO,
  ProductRecord,
  PromoEntity,
  Address,
  PaymentSummary,
  DeliveryOption,
} from "../types/entities";
import {
  IOrderRepository,
  IProductRepository,
  IPromoRepository,
} from "../repositories/interfaces";
import { MockBankService } from "./mockBankService";
import { MockGoogleAddressService } from "./mockGoogleAddressService";

export interface PaymentInput {
  cardNumber: string;
  cvv: string;
  cardholder: string;
  expMonth: number;
  expYear: number;
}

export interface SetAddressesInput {
  deliveryAddress: Address;
  invoiceAddress?: Address;
  sameAsDelivery: boolean;
  deliveryOption: DeliveryOption;
}

export class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private promoRepository: IPromoRepository,
    private bankService: MockBankService = new MockBankService(),
    private addressService: MockGoogleAddressService = new MockGoogleAddressService(),
  ) {}

  async getOrdersByUserId(userId: string): Promise<OrderDTO[]> {
    const orders = this.orderRepository.findByUserId(userId);
    return orders.map((order) => this.transformToDTO(order));
  }

  async getOrderById(
    orderId: string,
    userId: string,
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    return this.transformToDTO(order);
  }

  calculateOrderSum(
    products: Array<{ id: string; amount: number; price: number }>,
    promoId?: string,
  ): number {
    const subtotal = products.reduce((total, product) => {
      return total + product.amount * product.price;
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

  async deleteProductFromOrder(
    orderId: string,
    productId: string,
    userId: string,
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    // Remove the product from the order
    const updatedProducts = order.products.filter(
      (item) => item.id !== productId,
    );

    // If no products left, return null (order would be empty)
    if (updatedProducts.length === 0) {
      return null;
    }

    // Create updated order record
    const updatedOrder: OrderRecord = {
      ...order,
      products: updatedProducts,
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);

    // Transform to DTO and return
    return this.transformToDTO(updatedOrder);
  }

  async updateProductAmount(
    orderId: string,
    productId: string,
    newAmount: number,
    userId: string,
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    if (order.userId !== userId) {
      return null;
    }

    // Update the product amount
    const updatedProducts = order.products.map((item) =>
      item.id === productId
        ? { ...item, amount: Math.max(1, Math.min(10, newAmount)) }
        : item,
    );

    // Create updated order record
    const updatedOrder: OrderRecord = {
      ...order,
      products: updatedProducts,
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
    if (order.status !== "created") {
      return false;
    }

    // Update order status to 'submited'
    const updatedOrder: OrderRecord = {
      ...order,
      status: "submited",
    };

    // Update the in-memory repository
    this.updateOrder(updatedOrder);
    return true;
  }

  async setOrderAddresses(
    orderId: string,
    userId: string,
    input: SetAddressesInput,
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order || order.userId !== userId) {
      return null;
    }

    if (order.status !== "created") {
      throw new Error("Order is not in a state that allows updating addresses");
    }

    const invoice = input.sameAsDelivery
      ? input.deliveryAddress
      : input.invoiceAddress;

    if (!invoice) {
      throw new Error(
        "Invoice address is required when sameAsDelivery is false",
      );
    }

    const deliveryCost = this.addressService.getDeliveryCost(
      input.deliveryAddress,
      input.deliveryOption,
    );

    if (deliveryCost == null) {
      throw new Error("Delivery address is not serviceable");
    }

    const updatedOrder: OrderRecord = {
      ...order,
      deliveryAddress: input.deliveryAddress,
      invoiceAddress: invoice,
      deliveryOption: input.deliveryOption,
      deliveryCost,
    };

    this.updateOrder(updatedOrder);
    return this.transformToDTO(updatedOrder);
  }

  async payOrder(
    orderId: string,
    userId: string,
    payment: PaymentInput,
  ): Promise<OrderDTO | null> {
    const order = this.orderRepository.findById(orderId);

    if (!order || order.userId !== userId) {
      return null;
    }

    if (order.status !== "created") {
      throw new Error("Order is not in a state that allows payment");
    }

    if (!order.deliveryAddress || !order.invoiceAddress) {
      throw new Error(
        "Delivery and invoice addresses must be set before payment",
      );
    }

    if (!order.deliveryOption || order.deliveryCost == null) {
      throw new Error("Delivery option must be selected before payment");
    }

    const subtotal = this.calculateOrderSum(order.products, order.promo?.id);
    const amount = Math.round((subtotal + order.deliveryCost) * 100) / 100;

    const charge = await this.bankService.chargeCard({
      cardNumber: payment.cardNumber,
      cvv: payment.cvv,
      cardholder: payment.cardholder,
      expMonth: payment.expMonth,
      expYear: payment.expYear,
      amount,
      reference: orderId,
    });

    const summary: PaymentSummary = {
      last4: charge.last4,
      cardholder: payment.cardholder,
      expMonth: payment.expMonth,
      expYear: payment.expYear,
      bankTxnId: charge.bankTxnId,
      status: charge.status,
    };

    const updatedOrder: OrderRecord = {
      ...order,
      status: "processing",
      payment: summary,
    };

    this.updateOrder(updatedOrder);
    return this.transformToDTO(updatedOrder);
  }

  private updateOrder(updatedOrder: OrderRecord): void {
    // Update the order in the in-memory repository
    // This method should be called whenever order state changes
    this.orderRepository.update(updatedOrder);
    console.log(`Order ${updatedOrder.orderId} updated in repository`);
  }

  private transformToDTO(order: OrderRecord): OrderDTO {
    const products = order.products.map((item) => {
      const product = this.productRepository.findById(item.id);
      if (!product) {
        throw new Error(`Product with id ${item.id} not found`);
      }

      return {
        product,
        amount: Math.max(1, Math.min(10, item.amount)), // Ensure amount is between 1-10
        price: item.price,
      };
    });

    // Remove duplicates and sum amounts for same products
    const uniqueProducts = new Map<
      string,
      { product: ProductRecord; amount: number; price: number }
    >();

    products.forEach((item) => {
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
      deliveryAddress: order.deliveryAddress,
      invoiceAddress: order.invoiceAddress,
      deliveryOption: order.deliveryOption,
      deliveryCost: order.deliveryCost,
      payment: order.payment,
    };
  }
}
