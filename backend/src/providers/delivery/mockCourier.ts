import { IDeliveryProvider, DeliveryQuoteRequest } from './interfaces';
import { DeliveryOptionRecord } from '../../types/entities';

const KNOWN_CITIES = ['Moscow', 'Saint Petersburg', 'Berlin', 'London', 'New York'];

// Мок-интеграция №1: курьерская доставка, всегда доступна для любого адреса.
export class MockCourierProvider implements IDeliveryProvider {
  readonly id = 'courier';

  getQuote({ address }: DeliveryQuoteRequest): DeliveryOptionRecord {
    const isKnownCity = KNOWN_CITIES.includes(address.city.trim());

    return {
      id: 'courier',
      provider: 'MockCourierExpress',
      title: 'Курьером',
      price: isKnownCity ? 15 : 25,
      etaDays: isKnownCity ? 2 : 5,
      description: 'Доставка курьером до двери',
    };
  }
}
