import { Request, Response, NextFunction } from 'express';

let requestCount = 0;

export const errorTestMiddleware = (req: Request, res: Response, next: NextFunction) => {
  requestCount++;

  // Return error on every 3rd request
  // if (requestCount % 5 === 0) {
  //   return res.status(500).json({
  //     error: 'Test planned server error',
  //     message: 'This is a planned error for testing purposes'
  //   });
  // }

  next();
};
