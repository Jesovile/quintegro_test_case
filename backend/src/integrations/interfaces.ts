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

// Rejects with IntegrationUnavailableError when the call does not finish in time
export const withTimeout = <T>(call: Promise<T>, ms: number, service: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new IntegrationUnavailableError(service)), ms);
  });
  return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
};
