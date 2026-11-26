import { Router } from 'express';
import cors from 'cors';

export function createResetRoutes(repositories: Array<{ reset(): void }>): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    repositories.forEach(repo => repo.reset());
    res.json({ status: 'OK', message: 'Orders and promo redemptions reset to default state' });
  });

  return router;
}
