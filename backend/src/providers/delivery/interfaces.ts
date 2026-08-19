import { AddressRecord, DeliveryOptionRecord } from '../../types/entities';

export interface DeliveryQuoteRequest {
  address: AddressRecord;
  orderSubtotal: number;
}

export interface IDeliveryProvider {
  readonly id: string;
  getQuote(request: DeliveryQuoteRequest): DeliveryOptionRecord | null;
}
