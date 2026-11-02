export interface UsAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export type AddressValidationResult =
  | { ok: true; addressRef: string }
  | { ok: false; field: keyof UsAddress; reason: string };

// Thrown by an integration when the external service cannot answer (outage, timeout)
export class IntegrationUnavailableError extends Error {
  constructor(service: string) {
    super(`${service} is unavailable`);
    this.name = 'IntegrationUnavailableError';
  }
}

// Stores the address on its side; the order keeps only the opaque addressRef
export interface IGeoService {
  validateAddress(address: UsAddress): Promise<AddressValidationResult>;
  // null when the address was deleted or has expired on the service side
  getAddress(addressRef: string): Promise<UsAddress | null>;
  deleteAddress(addressRef: string): Promise<void>;
}

export type ChargeResult =
  | { status: 'approved'; paymentId: string }
  | { status: 'declined'; reason: string };

export type PaymentLookup =
  | { status: 'approved'; paymentId: string; amountUsd: number; refunded: boolean }
  | { status: 'declined' }
  | { status: 'unknown' };

// Card data never reaches this service: the browser exchanges it for a cardToken with the bank
export interface IBankGateway {
  // Repeating a charge with the same idempotencyKey never charges twice and returns the first result
  charge(input: { cardToken: string; amountUsd: number; idempotencyKey: string }): Promise<ChargeResult>;
  // Used when a charge timed out: tells whether the bank applied it
  getPaymentByKey(idempotencyKey: string): Promise<PaymentLookup>;
  refund(input: { paymentId: string; amountUsd: number; idempotencyKey: string }): Promise<{ status: 'refunded' | 'failed' }>;
}

export type FulfillmentStatus = 'running' | 'done' | 'failed';

// Prepares a paid order for delivery; resolves the address itself from addressRef
export interface IFulfillmentService {
  // The same idempotencyKey returns the same job, so a start whose answer was lost never creates a second job
  start(input: { orderId: string; addressRef: string; idempotencyKey: string }): Promise<{ jobId: string }>;
  getStatus(jobId: string): Promise<{ status: FulfillmentStatus }>;
}

// Rejects with IntegrationUnavailableError when the call does not finish in time
export const withTimeout = <T>(call: Promise<T>, ms: number, service: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new IntegrationUnavailableError(service)), ms);
  });
  return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
};
