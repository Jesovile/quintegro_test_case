import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import { CheckoutService } from './services/checkoutService';
import { PaymentService } from './services/paymentService';
import { ProcessingService } from './services/processingService';
import { CancellationService } from './services/cancellationService';
import { MockGeoService } from './integrations/mock/mockGeoService';
import { MockBankGateway } from './integrations/mock/mockBankGateway';
import { MockFulfillmentService } from './integrations/mock/mockFulfillmentService';
import { InMemoryUserRepository, InMemoryAuthRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from './repositories/implementations';

// The only place where repositories and services are wired together
export const createContainer = () => {
  const userRepository = new InMemoryUserRepository();
  const authRepository = new InMemoryAuthRepository();
  const orderRepository = new InMemoryOrderRepository();
  const productRepository = new InMemoryProductRepository();
  const promoRepository = new InMemoryPromoRepository();

  // Integration implementations: replace the mocks here with real services
  const geoService = new MockGeoService();
  const bankGateway = new MockBankGateway();
  const fulfillmentService = new MockFulfillmentService(geoService);

  const orderService = new OrderService(orderRepository, productRepository);
  const promoService = new PromoService(promoRepository);
  const paymentService = new PaymentService(orderRepository, orderService, geoService, bankGateway);

  return {
    orderRepository,
    authService: new AuthService(authRepository, userRepository),
    orderService,
    checkoutService: new CheckoutService(orderRepository, orderService, geoService, promoService, paymentService),
    paymentService,
    processingService: new ProcessingService(orderRepository, orderService, fulfillmentService),
    cancellationService: new CancellationService(orderRepository, orderService, paymentService, bankGateway, fulfillmentService),
    promoService
  };
};

export type Container = ReturnType<typeof createContainer>;
