import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity } from '../types/entities';
import {
  IUserRepository,
  IAuthRepository,
  IOrderRepository,
  IProductRepository,
  IPromoRepository,
  IBankService,
  BankPaymentSession,
  BankPaymentResult,
  CardData,
} from './interfaces';

export class InMemoryUserRepository implements IUserRepository {
  private users: UserRecord[] = [
    { id: 'user-1', name: 'John Doe' },
    { id: 'user-2', name: 'Jane Smith' },
  ];

  findById(id: string): UserRecord | undefined {
    return this.users.find(u => u.id === id);
  }

  findAll(): UserRecord[] {
    return [...this.users];
  }
}

export class InMemoryAuthRepository implements IAuthRepository {
  private authRecords: AuthRecord[] = [
    { userId: 'user-1', login: 'john.doe', password: 'password123' },
    { userId: 'user-2', login: 'jane.smith', password: 'password456' },
  ];

  findByLogin(login: string): AuthRecord | undefined {
    return this.authRecords.find(a => a.login === login);
  }

  findByLoginAndPassword(login: string, password: string): AuthRecord | undefined {
    return this.authRecords.find(a => a.login === login && a.password === password);
  }

  findAll(): AuthRecord[] {
    return [...this.authRecords];
  }
}

export class InMemoryProductRepository implements IProductRepository {
  private products: ProductRecord[] = [
    {
      id: 'product-1',
      title: 'Laptop',
      description: 'High-performance laptop with latest specifications and great battery life. Perfect for work and gaming.',
      image: '/productImg/laptop.svg',
    },
    {
      id: 'product-2',
      title: 'Smartphone',
      description: 'Modern smartphone with advanced camera system and long-lasting battery. Features the latest mobile technology.',
      image: '/productImg/smartphone.svg',
    },
    {
      id: 'product-3',
      title: 'Headphones',
      description: 'Wireless noise-canceling headphones with premium sound quality and comfortable design for extended use.',
      image: '/productImg/headphones.svg',
    },
    {
      id: 'product-4',
      title: 'Tablet',
      description: 'Lightweight tablet perfect for entertainment and productivity. Features a high-resolution display and fast processor.',
      image: '/productImg/tablet.svg',
    },
  ];

  findById(id: string): ProductRecord | undefined {
    return this.products.find(p => p.id === id);
  }

  findAll(): ProductRecord[] {
    return [...this.products];
  }
}

const buildSeedOrders = (): OrderRecord[] => {
  const now = Date.now();
  return [
    {
      orderId: 'order-1',
      userId: 'user-1',
      status: 'done',
      createdAt: now - 86400000,
      updatedAt: now - 3600000,
      products: [
        { id: 'product-1', amount: 1, price: 1299.99 },
        { id: 'product-3', amount: 2, price: 199.99 },
      ],
      checkoutData: {
        address: '123 Main St, New York, NY 10001',
        phone: '+19991234567',
        deliveryAt: new Date(now - 3600000).toISOString(),
      },
    },
    {
      orderId: 'order-2',
      userId: 'user-1',
      status: 'new',
      createdAt: now,
      updatedAt: now,
      products: [
        { id: 'product-2', amount: 1, price: 899.99 },
        { id: 'product-4', amount: 1, price: 599.99 },
      ],
    },
  ];
};

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: OrderRecord[] = buildSeedOrders();

  reset(): void {
    this.orders = buildSeedOrders();
  }

  findById(orderId: string): OrderRecord | undefined {
    return this.orders.find(o => o.orderId === orderId);
  }

  findByUserId(userId: string): OrderRecord[] {
    return this.orders.filter(o => o.userId === userId);
  }

  findByPaymentId(paymentId: string): OrderRecord | undefined {
    return this.orders.find(o => o.paymentId === paymentId);
  }

  findAll(): OrderRecord[] {
    return [...this.orders];
  }

  save(order: OrderRecord): void {
    this.orders.push(order);
  }

  update(order: OrderRecord): void {
    const index = this.orders.findIndex(o => o.orderId === order.orderId);
    if (index !== -1) {
      this.orders[index] = order;
    }
  }
}

export class InMemoryPromoRepository implements IPromoRepository {
  private promos: PromoEntity[] = [
    {
      id: 'SAVE10',
      discount: 10,
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'SAVE20',
      discount: 20,
      dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'SAVE5',
      discount: 5,
      dueDate: Date.now() - 24 * 60 * 60 * 1000,
    },
  ];

  findById(id: string): PromoEntity | undefined {
    return this.promos.find(p => p.id === id);
  }

  findAll(): PromoEntity[] {
    return [...this.promos];
  }
}

// Every 3rd processPayment call returns a failure (simulates declined payments).
export class MockBankService implements IBankService {
  private processCallCount = 0;
  private sessions = new Map<string, { orderId: string; amount: number; processed: boolean }>();

  initiatePayment(orderId: string, amount: number): BankPaymentSession {
    const paymentId = `pay-${orderId}-${Date.now()}`;
    this.sessions.set(paymentId, { orderId, amount, processed: false });
    return {
      paymentId,
      paymentUrl: `/mock-bank/pay/${paymentId}`,
    };
  }

  processPayment(paymentId: string, cardData?: CardData): BankPaymentResult {
    const session = this.sessions.get(paymentId);

    if (!session) {
      return { paymentId, success: false, errorCode: 'SESSION_NOT_FOUND' };
    }

    if (session.processed) {
      return { paymentId, success: false, errorCode: 'ALREADY_PROCESSED' };
    }

    if (cardData) {
      const digits = cardData.number.replace(/\D/g, '');
      if (digits.length !== 16) {
        return { paymentId, success: false, errorCode: 'INVALID_CARD_NUMBER' };
      }

      const cvvDigits = cardData.cvv.replace(/\D/g, '');
      if (cvvDigits.length < 3 || cvvDigits.length > 4) {
        return { paymentId, success: false, errorCode: 'INVALID_CVV' };
      }

      const [mm, yy] = cardData.expiry.split('/');
      const month = parseInt(mm, 10);
      const year = 2000 + parseInt(yy ?? '0', 10);
      const now = new Date();
      const isExpired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
      if (!mm || !yy || month < 1 || month > 12 || isExpired) {
        return { paymentId, success: false, errorCode: 'EXPIRED_CARD' };
      }
    }

    session.processed = true;
    this.processCallCount++;

    const shouldFail = this.processCallCount % 3 === 0;
    return {
      paymentId,
      success: !shouldFail,
      errorCode: shouldFail ? 'PAYMENT_DECLINED' : undefined,
    };
  }

  reset(): void {
    this.processCallCount = 0;
    this.sessions.clear();
  }
}
