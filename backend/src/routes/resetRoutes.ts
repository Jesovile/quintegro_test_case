import { Router } from 'express';
import cors from 'cors';
import { InMemoryOrderRepository, MockBankService } from '../repositories/implementations';

export function createResetRoutes(orderRepository: InMemoryOrderRepository, bankService: MockBankService): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    orderRepository.reset();
    bankService.reset();
    res.json({ status: 'OK', message: 'Order repository and bank service reset to default state' });
  });

  return router;
}
