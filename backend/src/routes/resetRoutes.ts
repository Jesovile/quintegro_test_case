import { Router } from 'express';
import cors from 'cors';
import { InMemoryOrderRepository } from '../repositories/implementations';

export function createResetRoutes(repository: InMemoryOrderRepository): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    repository.reset();
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
