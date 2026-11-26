import { AcquiringResultDTO, PaymentRequestDTO } from '../types/dtos';

export interface IAcquiringService {
  // Implementations must honor idempotencyKey and must not log card details.
  charge(request: PaymentRequestDTO): Promise<AcquiringResultDTO>;
}
