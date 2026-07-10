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
import { createPromoRoutes } from './routes/promoRoutes';
import { createResetRoutes } from './routes/resetRoutes';
import { AuthController } from './controllers/authController';
import { OrderController } from './controllers/orderController';
import { PromoController } from './controllers/promoController';
import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import { PaymentService } from './services/paymentService';
import { InMemoryUserRepository, InMemoryAuthRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository, InMemoryDeliveryMethodRepository, InMemoryPaymentRepository } from './repositories/implementations';

export class App {
  public app: express.Application;
  private resettableRepositories: Array<{ reset(): void }> = [];

  private userRepository: InMemoryUserRepository;
  private authRepository: InMemoryAuthRepository;
  private orderRepository: InMemoryOrderRepository;
  private productRepository: InMemoryProductRepository;
  private promoRepository: InMemoryPromoRepository;
  private deliveryMethodRepository: InMemoryDeliveryMethodRepository;
  private paymentRepository: InMemoryPaymentRepository;

  private authService: AuthService;
  private orderService: OrderService;
  private promoService: PromoService;
  private paymentService: PaymentService;

  constructor() {
    this.app = express();

    // Initialize repositories exactly once, shared between REST and GraphQL
    this.userRepository = new InMemoryUserRepository();
    this.authRepository = new InMemoryAuthRepository();
    this.orderRepository = new InMemoryOrderRepository();
    this.productRepository = new InMemoryProductRepository();
    this.promoRepository = new InMemoryPromoRepository();
    this.deliveryMethodRepository = new InMemoryDeliveryMethodRepository();
    this.paymentRepository = new InMemoryPaymentRepository();
    this.resettableRepositories.push(this.orderRepository, this.paymentRepository);

    // Initialize services exactly once, shared between REST and GraphQL
    this.authService = new AuthService(this.authRepository, this.userRepository);
    this.orderService = new OrderService(this.orderRepository, this.productRepository, this.promoRepository, this.deliveryMethodRepository);
    this.promoService = new PromoService(this.promoRepository);
    this.paymentService = new PaymentService(this.paymentRepository, this.orderRepository, this.orderService);
    // Setter injection to avoid a circular constructor dependency (feature 5,
    // closing the gap flagged by feature 4 — see orderService.ts's
    // setPaymentService doc comment): OrderService.transformToDTO needs
    // PaymentService.getSummaryForOrder to populate OrderDTO.payment for
    // order history / confirmation display.
    this.orderService.setPaymentService(this.paymentService);

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSwagger();
    this.initializeGraphQL();
  }

  private initializeMiddlewares(): void {
    this.app.use(helmet({ contentSecurityPolicy: (process.env.NODE_ENV === 'production') ? undefined : false }));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Add delay to all API requests
    this.app.use(delayMiddleware(1500));
    
    // Add error test middleware (returns 500 on every 3rd request)
    this.app.use(errorTestMiddleware);
    
    // Serve static files for product images
    this.app.use('/productImg', express.static('public/productImg'));
  }

  private initializeRoutes(): void {
    // Initialize controllers (repositories/services are constructed once in the
    // App constructor and shared with GraphQL, see initializeGraphQL())
    const authController = new AuthController(this.authService);
    const orderController = new OrderController(this.orderService, this.authService);
    const promoController = new PromoController(this.promoService);

    // Setup routes
    this.app.use('/api', createAuthRoutes(authController));
    this.app.use('/api/order', createOrderRoutes(orderController));
    this.app.use('/api/promo', createPromoRoutes(promoController));
    this.app.use('/reset/orders', createResetRoutes(this.resettableRepositories));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Quintegro API',
        version: '1.0.0',
        endpoints: {
          docs: '/api-docs',
          health: '/health',
          login: '/api/login',
          orders: '/api/order',
          promos: '/api/promo'
        }
      });
    });
  }

  private initializeSwagger(): void {
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private async initializeGraphQL(): Promise<void> {
    // Reuses the same repository/service instances constructed in the App
    // constructor and used by initializeRoutes(), so REST and GraphQL never
    // see divergent data.

    // Create Apollo Server
    const apolloServer = createApolloServer(this.orderService, this.authService, this.promoService, this.deliveryMethodRepository, this.paymentService);
    await apolloServer.start();

    // Apply Apollo Server middleware
    apolloServer.applyMiddleware({ 
      app: this.app, 
      path: '/graphql',
      cors: false // We're already using CORS middleware
    });

    console.log(`🚀 GraphQL server ready at http://localhost:3000${apolloServer.graphqlPath}`);
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
