import { CheckoutErrorCode } from '../types/enums';

export class CheckoutError extends Error {
  constructor(public readonly code: CheckoutErrorCode, message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export class CheckoutValidationError extends CheckoutError {
  constructor(message: string) {
    super(CheckoutErrorCode.VALIDATION_ERROR, message);
    this.name = 'CheckoutValidationError';
  }
}
