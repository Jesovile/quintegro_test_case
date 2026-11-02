import { Router } from 'express';
import cors from 'cors';

export function createResetRoutes(resetTestState: () => void): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    resetTestState();
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
