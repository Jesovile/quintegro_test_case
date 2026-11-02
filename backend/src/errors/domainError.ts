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
  | 'DELIVERY_REQUIRED'
  | 'TOTAL_CHANGED'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_UNAVAILABLE'
  | 'PAYMENT_UNCONFIRMED'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAYMENT_REFUNDED'
  | 'REFUND_PENDING'
  | 'REFUND_FAILED'
  | 'ORDER_NOT_CANCELLABLE'
  | 'CANCEL_UNAVAILABLE'
  | 'REFUND_UNCONFIRMED'
  | 'PROCESSING_FAILED'
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
