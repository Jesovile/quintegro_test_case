import { Router } from 'express';
import cors from 'cors';
interface ResettableRepository {
  reset(): void;
}

export function createResetRoutes(repositories: ResettableRepository[]): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    repositories.forEach(repo => repo.reset());
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
