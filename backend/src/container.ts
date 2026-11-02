import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import { CheckoutService } from './services/checkoutService';
import { MockGeoService } from './integrations/mock/mockGeoService';
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

  const orderService = new OrderService(orderRepository, productRepository);

  return {
    orderRepository,
    authService: new AuthService(authRepository, userRepository),
    orderService,
    checkoutService: new CheckoutService(orderRepository, orderService, geoService),
    promoService: new PromoService(promoRepository)
  };
};

export type Container = ReturnType<typeof createContainer>;
