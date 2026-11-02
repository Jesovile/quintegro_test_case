export type DomainErrorCode =
  | 'UNAUTHENTICATED'
  | 'INTERNAL'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_EDITABLE'
  | 'ORDER_EMPTY'
  | 'INVALID_STATUS_TRANSITION'
  | 'VALIDATION_FAILED'
  | 'ADDRESS_REJECTED'
  | 'GEO_UNAVAILABLE'
  | 'ADDRESS_NOT_FOUND'
  | 'PROMO_NOT_FOUND'
  | 'PROMO_EXPIRED';

export interface FieldError {
  field: string;
  message: string;
}

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly fields?: FieldError[]
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
