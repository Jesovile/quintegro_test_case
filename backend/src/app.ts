import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import { delayMiddleware } from './middleware/delayMiddleware';
import { errorTestMiddleware } from './middleware/errorTestMiddleware';
import { createApolloServer } from './graphql/server';
import { createAuthRoutes } from './routes/authRoutes';
import { createOrderRoutes } from './routes/orderRoutes';
import { createCheckoutRoutes } from './routes/checkoutRoutes';
import { createWebhookRoutes } from './routes/webhookRoutes';
import { createPromoRoutes } from './routes/promoRoutes';
import { createResetRoutes } from './routes/resetRoutes';
import { AuthController } from './controllers/authController';
import { OrderController } from './controllers/orderController';
import { CheckoutController } from './controllers/checkoutController';
import { WebhookController } from './controllers/webhookController';
import { PromoController } from './controllers/promoController';
import { AuthService } from './services/authService';
import { OrderQueryService } from './services/orderQueryService';
import { CartService } from './services/cartService';
import { PricingService } from './services/pricingService';
import { CheckoutService } from './services/checkoutService';
import { PaymentService } from './services/paymentService';
import { OrderStatusService } from './services/orderStatusService';
import { PromoService } from './services/promoService';
import { EncryptionService } from './services/encryptionService';
import {
  InMemoryUserRepository,
  InMemoryAuthRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryPromoRepository,
  MockBankService,
} from './repositories/implementations';

export class App {
  public app: express.Application;

  // Shared repositories — single source of truth for all layers (REST + GraphQL)
  private orderRepository: InMemoryOrderRepository;
  private bankService: MockBankService;

  constructor() {
    this.app = express();

    // Build shared repos once
    const userRepository = new InMemoryUserRepository();
    const authRepository = new InMemoryAuthRepository();
    this.orderRepository = new InMemoryOrderRepository();
    const productRepository = new InMemoryProductRepository();
    const promoRepository = new InMemoryPromoRepository();
    this.bankService = new MockBankService();

    // Services
    const encryptionService = new EncryptionService();
    const authService = new AuthService(authRepository, userRepository);
    const promoService = new PromoService(promoRepository);
    const orderStatusService = new OrderStatusService();
    const orderQueryService = new OrderQueryService(this.orderRepository, productRepository);
    const cartService = new CartService(this.orderRepository, orderQueryService);
    const pricingService = new PricingService(promoRepository);
    const checkoutService = new CheckoutService(
      this.orderRepository,
      promoRepository,
      pricingService,
      this.bankService,
      orderStatusService,
    );
    const paymentService = new PaymentService(this.orderRepository, this.bankService, orderStatusService);

    this.initializeMiddlewares();
    this.initializeRoutes({
      authService,
      orderQueryService,
      cartService,
      pricingService,
      checkoutService,
      paymentService,
      promoService,
    });
    this.initializeSwagger();
    this.initializeGraphQL({
      authService,
      orderQueryService,
      cartService,
      pricingService,
      checkoutService,
      paymentService,
      promoService,
      encryptionService,
    });
  }

  private initializeMiddlewares(): void {
    this.app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(delayMiddleware(1500));
    this.app.use(errorTestMiddleware);
    this.app.use('/productImg', express.static('public/productImg'));
  }

  private initializeRoutes(services: {
    authService: AuthService;
    orderQueryService: OrderQueryService;
    cartService: CartService;
    pricingService: PricingService;
    checkoutService: CheckoutService;
    paymentService: PaymentService;
    promoService: PromoService;
  }): void {
    const { authService, orderQueryService, cartService, pricingService, checkoutService, paymentService, promoService } = services;

    const authController = new AuthController(authService);
    const orderController = new OrderController(orderQueryService, cartService, pricingService, authService);
    const checkoutController = new CheckoutController(checkoutService, authService);
    const webhookController = new WebhookController(paymentService);
    const promoController = new PromoController(promoService);

    this.app.use('/api', createAuthRoutes(authController));
    this.app.use('/api/order', createOrderRoutes(orderController));
    this.app.use('/api/order', createCheckoutRoutes(checkoutController));
    this.app.use('/api/webhooks', createWebhookRoutes(webhookController));
    this.app.use('/api/promo', createPromoRoutes(promoController));
    this.app.use('/reset/orders', createResetRoutes(this.orderRepository, this.bankService));

    this.app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    this.app.get('/', (_req, res) => {
      res.json({
        message: 'Quintegro API',
        version: '2.0.0',
        endpoints: {
          docs: '/api-docs',
          health: '/health',
          login: '/api/login',
          orders: '/api/order',
          checkout: '/api/order/:orderId/checkout',
          cancel: '/api/order/:orderId/cancel',
          webhook: '/api/webhooks/payment',
          promos: '/api/promo',
        },
      });
    });
  }

  private initializeSwagger(): void {
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeGraphQL(services: {
    authService: AuthService;
    orderQueryService: OrderQueryService;
    cartService: CartService;
    pricingService: PricingService;
    checkoutService: CheckoutService;
    paymentService: PaymentService;
    promoService: PromoService;
    encryptionService: EncryptionService;
  }): void {
    const apolloServer = createApolloServer(services);
    apolloServer.start().then(() => {
      apolloServer.applyMiddleware({ app: this.app, path: '/graphql', cors: false });
      console.log(`🚀 GraphQL server ready at http://localhost:3000${apolloServer.graphqlPath}`);
    });
  }

  public listen(port: number): void {
    this.app.listen(port, () => {
      console.log(`🚀 Server is running on port ${port}`);
      console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
      console.log(`🔐 Login endpoint: http://localhost:${port}/api/login`);
      console.log(`🔮 GraphQL Playground available at http://localhost:${port}/graphql`);
    });
  }
}
