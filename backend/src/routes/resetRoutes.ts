import { Router } from 'express';
import cors from 'cors';
import { CheckoutErrorCode } from '../types/enums';

export function createResetRoutes(resetOrders: () => boolean): Router {
  const router = Router();

  router.get('/', cors({ origin: '*' }), (_req, res) => {
    if (!resetOrders()) {
      return res.status(409).json({ code: CheckoutErrorCode.ORDER_PROCESSING, message: 'Cannot reset while payment is in progress' });
    }
    res.json({ status: 'OK', message: 'Order repository reset to default state' });
  });

  return router;
}
