export type DomainErrorCode =
  | 'UNAUTHENTICATED'
  | 'INTERNAL'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_EDITABLE'
  | 'PROMO_NOT_FOUND'
  | 'PROMO_EXPIRED';

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
