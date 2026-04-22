import { Request, Response, NextFunction } from 'express';

let requestCount = 0;

export const errorTestMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_ERROR_TEST === '1') {
    return next();
  }

  requestCount++;

  // Return 500 on every 5th request to simulate flakiness in dev
  if (requestCount % 5 === 0) {
    return res.status(500).json({
      error: 'Test planned server error',
      message: 'This is a planned error for testing purposes'
    });
  }

  next();
};

