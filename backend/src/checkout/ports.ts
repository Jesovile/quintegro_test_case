import {
  DeliveryCancelInput,
  DeliveryQuote,
  DeliveryQuoteInput,
  DeliveryScheduleInput,
  PaymentAuthorization,
  PaymentAuthorizationInput,
  PaymentCapture,
  PaymentCaptureInput,
  PaymentVoidInput,
  ScheduledDelivery,
} from './types';

export interface PaymentGateway {
  authorize(input: PaymentAuthorizationInput): Promise<PaymentAuthorization>;
  capture(input: PaymentCaptureInput): Promise<PaymentCapture>;
  void(input: PaymentVoidInput): Promise<void>;
}

export interface DeliveryGateway {
  quote(input: DeliveryQuoteInput): Promise<DeliveryQuote>;
  schedule(input: DeliveryScheduleInput): Promise<ScheduledDelivery>;
  cancel(input: DeliveryCancelInput): Promise<void>;
}
