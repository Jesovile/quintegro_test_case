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
import { InMemoryUserRepository, InMemoryAuthRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from './repositories/implementations';

export class App {
  public app: express.Application;
  private userRepository = new InMemoryUserRepository();
  private authRepository = new InMemoryAuthRepository();
  private orderRepository = new InMemoryOrderRepository();
  private productRepository = new InMemoryProductRepository();
  private promoRepository = new InMemoryPromoRepository();

  private authService = new AuthService(this.authRepository, this.userRepository);
  private orderService = new OrderService(this.orderRepository, this.productRepository, this.promoRepository);
  private promoService = new PromoService(this.promoRepository);

  constructor() {
    this.app = express();
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
    const authController = new AuthController(this.authService);
    const orderController = new OrderController(this.orderService, this.authService);
    const promoController = new PromoController(this.promoService);

    this.app.use('/api', createAuthRoutes(authController));
    this.app.use('/api/order', createOrderRoutes(orderController));
    this.app.use('/api/promo', createPromoRoutes(promoController));
    this.app.use('/reset/orders', createResetRoutes([this.orderRepository]));

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
    const apolloServer = createApolloServer(this.orderService, this.authService, this.promoService);
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
