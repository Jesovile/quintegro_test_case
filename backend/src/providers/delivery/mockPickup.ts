import { IDeliveryProvider, DeliveryQuoteRequest } from './interfaces';
import { DeliveryOptionRecord } from '../../types/entities';

const SUPPORTED_CITIES = ['Moscow', 'Saint Petersburg', 'Berlin', 'London', 'New York'];

// Мок-интеграция №2: самовывоз, доступен только в городах с пунктом выдачи.
export class MockPickupProvider implements IDeliveryProvider {
  readonly id = 'pickup';

  getQuote({ address }: DeliveryQuoteRequest): DeliveryOptionRecord | null {
    if (!SUPPORTED_CITIES.includes(address.city.trim())) {
      return null;
    }

    return {
      id: 'pickup',
      provider: 'MockPickupPoint',
      title: 'Самовывоз',
      price: 0,
      etaDays: 1,
      description: 'Пункт самовывоза в вашем городе',
    };
  }
}
