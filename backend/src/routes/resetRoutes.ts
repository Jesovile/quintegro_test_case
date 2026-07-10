import { Router } from 'express';
import cors from 'cors';

// Widened from InMemoryOrderRepository[] to a structural { reset(): void }[]
// so InMemoryPaymentRepository (and any future resettable repository) can be
// included without a signature change — see tech-design.md §2.4 /
// implementation-plan-04.md iteration 4.2.
export function createResetRoutes(repositories: Array<{ reset(): void }>): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    repositories.forEach(repo => repo.reset());
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
