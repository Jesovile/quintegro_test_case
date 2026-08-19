import { OrderService } from './orderService';
import { IOrderRepository, IProductRepository } from '../repositories/interfaces';
import { AddressRecord, DeliveryOptionRecord, OrderDTO, OrderRecord } from '../types/entities';
import { IDeliveryProvider } from '../providers/delivery/interfaces';
import { IPaymentProvider, PaymentErrorCode } from '../providers/payment/interfaces';

const RESERVATION_TTL_MS = Number(process.env.RESERVATION_TTL_MS) || 5 * 60 * 1000;

export interface ReserveItemIssue {
  productId: string;
  productTitle: string;
  requested: number;
  available: number;
}

export type ReserveErrorCode = 'INSUFFICIENT_STOCK' | 'INVALID_STATUS' | 'DELIVERY_OPTION_INVALID';

export interface ReserveResult {
  success: boolean;
  order?: OrderDTO;
  reservedUntil?: number;
  issues?: ReserveItemIssue[];
  errorCode?: ReserveErrorCode;
}

export type PayErrorCode = PaymentErrorCode | 'RESERVATION_EXPIRED' | 'INVALID_STATUS';

export interface PaymentInput {
  method: 'card' | 'paypal';
  card?: {
    cardNumber: string;
    cardHolder: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
  };
  paypal?: {
    email: string;
  };
}

export interface PayResult {
  success: boolean;
  order?: OrderDTO;
  errorCode?: PayErrorCode;
  errorMessage?: string;
}

export class CheckoutService {
  private reservationTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private orderService: OrderService,
    private orderRepository: IOrderRepository,
    private productRepository: IProductRepository,
    private deliveryProviders: IDeliveryProvider[],
    private paymentProvider: IPaymentProvider
  ) {}

  getDeliveryOptions(orderId: string, userId: string, address: AddressRecord): DeliveryOptionRecord[] | null {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }

    const subtotal = order.products.reduce((sum, item) => sum + item.amount * item.price, 0);

    return this.deliveryProviders
      .map((provider) => provider.getQuote({ address, orderSubtotal: subtotal }))
      .filter((quote): quote is DeliveryOptionRecord => quote !== null);
  }

  async reserveOrder(
    orderId: string,
    userId: string,
    address: AddressRecord,
    deliveryOptionId: string
  ): Promise<ReserveResult | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }

    // Идемпотентность: повторный вызов на уже активной брони не должен списывать сток второй раз.
    if (order.status === 'reserved' && order.reservedUntil && order.reservedUntil > Date.now()) {
      return { success: true, order: await this.orderService.getOrderById(orderId, userId) ?? undefined, reservedUntil: order.reservedUntil };
    }

    if (order.status !== 'created') {
      return { success: false, errorCode: 'INVALID_STATUS' };
    }

    const options = this.getDeliveryOptions(orderId, userId, address) ?? [];
    const selectedOption = options.find((option) => option.id === deliveryOptionId);
    if (!selectedOption) {
      return { success: false, errorCode: 'DELIVERY_OPTION_INVALID' };
    }

    const issues: ReserveItemIssue[] = [];
    for (const item of order.products) {
      const product = this.productRepository.findById(item.id);
      const available = product?.stock ?? 0;
      if (available < item.amount) {
        issues.push({ productId: item.id, productTitle: product?.title ?? item.id, requested: item.amount, available });
      }
    }

    if (issues.length > 0) {
      return { success: false, errorCode: 'INSUFFICIENT_STOCK', issues };
    }

    for (const item of order.products) {
      const product = this.productRepository.findById(item.id);
      if (product) {
        this.productRepository.update({ ...product, stock: product.stock - item.amount });
      }
    }

    const reservedUntil = Date.now() + RESERVATION_TTL_MS;
    const updatedOrder: OrderRecord = {
      ...order,
      status: 'reserved',
      address,
      deliveryOption: selectedOption,
      reservedUntil,
    };
    this.orderRepository.update(updatedOrder);
    this.scheduleReservationExpiry(orderId);

    return { success: true, order: await this.orderService.getOrderById(orderId, userId) ?? undefined, reservedUntil };
  }

  async payOrder(orderId: string, userId: string, payment: PaymentInput): Promise<PayResult | null> {
    const order = this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }

    // Идемпотентность: если оплата уже прошла ранее, повторный вызов не списывает деньги второй раз.
    if (order.status === 'paid' || order.status === 'submited' || order.status === 'finished') {
      return { success: true, order: await this.orderService.getOrderById(orderId, userId) ?? undefined };
    }

    if (order.status !== 'reserved') {
      return { success: false, errorCode: 'INVALID_STATUS' };
    }

    if (!order.reservedUntil || order.reservedUntil <= Date.now()) {
      this.releaseReservation(orderId);
      return { success: false, errorCode: 'RESERVATION_EXPIRED', errorMessage: 'Время резервирования истекло, оформите заказ заново.' };
    }

    const amount = order.products.reduce((sum, item) => {
      const product = this.productRepository.findById(item.id);
      return sum + (product?.price ?? item.price) * item.amount;
    }, order.deliveryOption?.price ?? 0);

    const chargeResult = await this.paymentProvider.charge({
      amount,
      method: payment.method,
      card: payment.card,
      paypal: payment.paypal,
    });

    if (!chargeResult.success) {
      return { success: false, errorCode: chargeResult.errorCode, errorMessage: chargeResult.errorMessage };
    }

    this.clearReservationTimer(orderId);
    const updatedOrder: OrderRecord = { ...order, status: 'paid' };
    this.orderRepository.update(updatedOrder);

    return { success: true, order: await this.orderService.getOrderById(orderId, userId) ?? undefined };
  }

  private scheduleReservationExpiry(orderId: string): void {
    this.clearReservationTimer(orderId);
    const timer = setTimeout(() => this.releaseReservation(orderId), RESERVATION_TTL_MS);
    this.reservationTimers.set(orderId, timer);
  }

  private clearReservationTimer(orderId: string): void {
    const timer = this.reservationTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.reservationTimers.delete(orderId);
    }
  }

  private releaseReservation(orderId: string): void {
    this.clearReservationTimer(orderId);
    const order = this.orderRepository.findById(orderId);
    if (!order || order.status !== 'reserved') {
      return;
    }

    for (const item of order.products) {
      const product = this.productRepository.findById(item.id);
      if (product) {
        this.productRepository.update({ ...product, stock: product.stock + item.amount });
      }
    }

    this.orderRepository.update({
      ...order,
      status: 'created',
      address: undefined,
      deliveryOption: undefined,
      reservedUntil: undefined,
    });
  }
}
