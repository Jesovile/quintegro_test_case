import { AcquiringResultDTO, PaymentRequestDTO } from '../types/dtos';
import { IAcquiringService } from './interfaces';

export class MockAcquiringService implements IAcquiringService {
  async charge(request: PaymentRequestDTO): Promise<AcquiringResultDTO> {
    if (request.creditCard.number === '4000000000000002') {
      return { status: 'declined' };
    }
    if (request.creditCard.number === '4000000000000119') {
      return { status: 'provider_error' };
    }
    return { status: 'approved', paymentId: `mock-${request.idempotencyKey}`, provider: 'mock' };
  }
}
