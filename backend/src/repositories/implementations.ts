import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity, DeliveryMethodOption, DeliveryMethodType, PaymentRecord } from '../types/entities';
import { IUserRepository, IAuthRepository, IOrderRepository, IProductRepository, IPromoRepository, IDeliveryMethodRepository, IPaymentRepository } from './interfaces';

export class InMemoryUserRepository implements IUserRepository {
  private users: UserRecord[] = [
    {
      id: "user-1",
      name: "John Doe"
    },
    {
      id: "user-2", 
      name: "Jane Smith"
    }
  ];

  findById(id: string): UserRecord | undefined {
    return this.users.find(user => user.id === id);
  }

  findAll(): UserRecord[] {
    return [...this.users];
  }
}

export class InMemoryAuthRepository implements IAuthRepository {
  private authRecords: AuthRecord[] = [
    {
      userId: "user-1",
      login: "john.doe",
      password: "password123"
    },
    {
      userId: "user-2",
      login: "jane.smith", 
      password: "password456"
    }
  ];

  findByLogin(login: string): AuthRecord | undefined {
    return this.authRecords.find(auth => auth.login === login);
  }

  findByLoginAndPassword(login: string, password: string): AuthRecord | undefined {
    return this.authRecords.find(auth => 
      auth.login === login && auth.password === password
    );
  }

  findAll(): AuthRecord[] {
    return [...this.authRecords];
  }
}

export class InMemoryProductRepository implements IProductRepository {
  private products: ProductRecord[] = [
    {
      id: "product-1",
      title: "Laptop",
      description: "High-performance laptop with latest specifications and great battery life. Perfect for work and gaming.",
      image: "/productImg/laptop.svg"
    },
    {
      id: "product-2",
      title: "Smartphone",
      description: "Modern smartphone with advanced camera system and long-lasting battery. Features the latest mobile technology.",
      image: "/productImg/smartphone.svg"
    },
    {
      id: "product-3",
      title: "Headphones",
      description: "Wireless noise-canceling headphones with premium sound quality and comfortable design for extended use.",
      image: "/productImg/headphones.svg"
    },
    {
      id: "product-4",
      title: "Tablet",
      description: "Lightweight tablet perfect for entertainment and productivity. Features a high-resolution display and fast processor.",
      image: "/productImg/tablet.svg"
    }
  ];

  findById(id: string): ProductRecord | undefined {
    return this.products.find(product => product.id === id);
  }

  findAll(): ProductRecord[] {
    return [...this.products];
  }
}

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: OrderRecord[] = [
    {
      orderId: "order-1",
      userId: "user-1",
      status: "finished",
      createAt: Date.now() - 86400000, // 1 day ago
      products: [
        { id: "product-1", amount: 1, price: 1299.99 },
        { id: "product-3", amount: 2, price: 199.99 }
      ]
    },
    {
      orderId: "order-2",
      userId: "user-1",
      status: "created",
      createAt: Date.now(),
      products: [
        { id: "product-2", amount: 1, price: 899.99 },
        { id: "product-4", amount: 1, price: 599.99 }
      ]
    }
  ];

  reset(): void {
    this.orders = [
      {
        orderId: "order-1",
        userId: "user-1",
        status: "finished",
        createAt: Date.now() - 86400000,
        products: [
          { id: "product-1", amount: 1, price: 1299.99 },
          { id: "product-3", amount: 2, price: 199.99 }
        ]
      },
      {
        orderId: "order-2",
        userId: "user-1",
        status: "created",
        createAt: Date.now(),
        products: [
          { id: "product-2", amount: 1, price: 899.99 },
          { id: "product-4", amount: 1, price: 599.99 }
        ]
      }
    ];
  }

  findById(orderId: string): OrderRecord | undefined {
    return this.orders.find(order => order.orderId === orderId);
  }

  findByUserId(userId: string): OrderRecord[] {
    return this.orders.filter(order => order.userId === userId);
  }

  findAll(): OrderRecord[] {
    return [...this.orders];
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
      id: "SAVE10",
      discount: 10,
      dueDate: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    {
      id: "SAVE20",
      discount: 20,
      dueDate: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    {
      id: "SAVE5",
      discount: 5,
      dueDate: Date.now() - (24 * 60 * 60 * 1000) // 1 day ago (expired)
    }
  ];

  findById(id: string): PromoEntity | undefined {
    return this.promos.find(promo => promo.id === id);
  }

  findAll(): PromoEntity[] {
    return [...this.promos];
  }
}

// Fixed catalog of delivery methods (config, not per-order) — see
// tech-design.md §2.2. Placeholder fee/day values pending product sign-off,
// see docs/decisions.md.
export class InMemoryDeliveryMethodRepository implements IDeliveryMethodRepository {
  private deliveryMethods: DeliveryMethodOption[] = [
    {
      type: 'regular',
      label: 'Regular',
      fee: 5.99,
      estimatedDays: '3-5'
    },
    {
      type: 'extra',
      label: 'Extra',
      fee: 14.99,
      estimatedDays: '1-2'
    }
  ];

  findAll(): DeliveryMethodOption[] {
    return [...this.deliveryMethods];
  }

  findByType(type: DeliveryMethodType): DeliveryMethodOption | undefined {
    return this.deliveryMethods.find(method => method.type === type);
  }
}

// In-memory payment attempts store — mirrors InMemoryOrderRepository's shape
// (private array + reset()). See tech-design.md §2.4.
export class InMemoryPaymentRepository implements IPaymentRepository {
  private payments: PaymentRecord[] = [];

  reset(): void {
    this.payments = [];
  }

  findById(paymentId: string): PaymentRecord | undefined {
    return this.payments.find(payment => payment.paymentId === paymentId);
  }

  findByOrderId(orderId: string): PaymentRecord[] {
    return this.payments.filter(payment => payment.orderId === orderId);
  }

  findByIdempotencyKey(orderId: string, idempotencyKey: string): PaymentRecord | undefined {
    return this.payments.find(
      payment => payment.orderId === orderId && payment.idempotencyKey === idempotencyKey
    );
  }

  create(payment: PaymentRecord): void {
    this.payments.push(payment);
  }

  update(payment: PaymentRecord): void {
    const index = this.payments.findIndex(p => p.paymentId === payment.paymentId);
    if (index !== -1) {
      this.payments[index] = payment;
    }
  }
}
