import { Request, Response, NextFunction } from 'express';

export const delayMiddleware = (delayMs: number = 3000) => {
  const disabled = process.env.NODE_ENV === 'test' || process.env.DISABLE_ARTIFICIAL_DELAY === '1';
  return (req: Request, res: Response, next: NextFunction) => {
    if (disabled) return next();
    setTimeout(next, delayMs);
  };
};
