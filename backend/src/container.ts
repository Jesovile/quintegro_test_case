import { AuthService } from './services/authService';
import { OrderService } from './services/orderService';
import { PromoService } from './services/promoService';
import { InMemoryUserRepository, InMemoryAuthRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from './repositories/implementations';

// The only place where repositories and services are wired together
export const createContainer = () => {
  const userRepository = new InMemoryUserRepository();
  const authRepository = new InMemoryAuthRepository();
  const orderRepository = new InMemoryOrderRepository();
  const productRepository = new InMemoryProductRepository();
  const promoRepository = new InMemoryPromoRepository();

  return {
    orderRepository,
    authService: new AuthService(authRepository, userRepository),
    orderService: new OrderService(orderRepository, productRepository),
    promoService: new PromoService(promoRepository)
  };
};

export type Container = ReturnType<typeof createContainer>;
