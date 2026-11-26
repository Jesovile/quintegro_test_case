import { CheckoutError } from '../errors/checkoutError';
import { CheckoutRecord } from '../types/entities';
import { SubmitOrderSuccessDTO, SubmitOrderFailureDTO } from '../types/dtos';
import { CheckoutErrorCode } from '../types/enums';

export function checkoutSuccess(checkout: CheckoutRecord): SubmitOrderSuccessDTO {
  return {
    success: true,
    code: 'APPROVED',
    message: 'Order submitted',
    orderId: checkout.orderId,
    paymentId: checkout.paymentId,
    paymentProvider: checkout.paymentProvider
  };
}

export function checkoutFailure(error: unknown, orderId: string): SubmitOrderFailureDTO {
  return {
    success: false,
    code: error instanceof CheckoutError ? error.code : CheckoutErrorCode.INTERNAL_ERROR,
    message: error instanceof CheckoutError ? error.message : 'Failed to submit order',
    orderId
  };
}
