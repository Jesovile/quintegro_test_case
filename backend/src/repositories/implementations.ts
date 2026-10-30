import { UserRecord, AuthRecord, OrderRecord, ProductRecord, PromoEntity } from '../types/entities';
import { IUserRepository, IAuthRepository, IOrderRepository, IProductRepository, IPromoRepository } from './interfaces';

const PRODUCT_COUNT = 40;
const CURRENT_ORDER_PRICES = [1300, 900, 200, 600];

// Extends the catalog with numbered variants of the base products
const generateProducts = (base: ProductRecord[], total: number): ProductRecord[] =>
  Array.from({ length: total - base.length }, (_, i) => {
    const source = base[i % base.length];
    const index = base.length + i + 1;
    return { ...source, id: `product-${index}`, title: `${source.title} #${index}` };
  });

// One position per product for the current (created) order
const createCurrentOrderProducts = (): OrderRecord['products'] =>
  Array.from({ length: PRODUCT_COUNT }, (_, i) => ({
    id: `product-${i + 1}`,
    amount: 1,
    price: CURRENT_ORDER_PRICES[i % CURRENT_ORDER_PRICES.length]
  }));

const createSeedOrders = (): OrderRecord[] => [
  {
    orderId: "order-1",
    userId: "user-1",
    status: "deliver",
    createAt: Date.now() - 86400000, // 1 day ago
    products: [
      { id: "product-1", amount: 1, price: 1300 },
      { id: "product-3", amount: 2, price: 200 }
    ]
  },
  {
    orderId: "order-2",
    userId: "user-1",
    status: "created",
    createAt: Date.now(),
    products: createCurrentOrderProducts()
  },
  {
    orderId: "order-3",
    userId: "user-1",
    status: "processing",
    createAt: Date.now() - 7200000, // 2 hours ago
    products: [
      { id: "product-2", amount: 2, price: 900 },
      { id: "product-3", amount: 1, price: 200 }
    ]
  }
];

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

  constructor() {
    this.products.push(...generateProducts(this.products, PRODUCT_COUNT));
  }

  findById(id: string): ProductRecord | undefined {
    return this.products.find(product => product.id === id);
  }

  findAll(): ProductRecord[] {
    return [...this.products];
  }
}

export class InMemoryOrderRepository implements IOrderRepository {
  private orders: OrderRecord[] = createSeedOrders();

  reset(): void {
    this.orders = createSeedOrders();
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
