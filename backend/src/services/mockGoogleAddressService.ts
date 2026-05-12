import { Address, DeliveryOption } from '../types/entities';

export type AddressLocation = Pick<
  Address,
  'country' | 'state' | 'city' | 'postalCode' | 'street'
>;

export interface AddressSuggestion extends AddressLocation {
  id: string;
  description: string;
}

export interface DeliveryRates {
  fast: number;
  super_fast: number;
  extra_fast: number;
}

const DELIVERY_BASE: Record<DeliveryOption, number> = {
  fast: 10,
  super_fast: 100,
  extra_fast: 1000,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const randomCoeff = () => round2(0.8 + Math.random() * 0.7); // [0.80, 1.50]

const KNOWN_ADDRESSES: AddressSuggestion[] = [
  {
    id: 'google-hq',
    description: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
    country: 'United States',
    state: 'California',
    city: 'Mountain View',
    postalCode: '94043',
    street: '1600 Amphitheatre Parkway',
  },
  {
    id: 'empire-state',
    description: '350 5th Avenue, New York, NY 10118, USA',
    country: 'United States',
    state: 'New York',
    city: 'New York',
    postalCode: '10118',
    street: '350 5th Avenue',
  },
  {
    id: 'baker-street',
    description: '221B Baker Street, London NW1 6XE, United Kingdom',
    country: 'United Kingdom',
    state: 'England',
    city: 'London',
    postalCode: 'NW1 6XE',
    street: '221B Baker Street',
  },
  {
    id: 'paix-paris',
    description: '8 Rue de la Paix, 75002 Paris, France',
    country: 'France',
    state: 'Île-de-France',
    city: 'Paris',
    postalCode: '75002',
    street: '8 Rue de la Paix',
  },
  {
    id: 'friedrichstrasse',
    description: 'Friedrichstraße 43, 10117 Berlin, Germany',
    country: 'Germany',
    state: 'Berlin',
    city: 'Berlin',
    postalCode: '10117',
    street: 'Friedrichstraße 43',
  },
];

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesLocation = (a: AddressLocation, b: AddressLocation): boolean => {
  return (
    normalize(a.country) === normalize(b.country) &&
    normalize(a.state) === normalize(b.state) &&
    normalize(a.city) === normalize(b.city) &&
    normalize(a.postalCode) === normalize(b.postalCode) &&
    normalize(a.street) === normalize(b.street)
  );
};

export class MockGoogleAddressService {
  // Coefficients per address per option, initialized once on construction
  // so the rates a user is shown stay stable through the checkout flow.
  private readonly coeffs: Record<string, Record<DeliveryOption, number>> = {};

  constructor() {
    for (const a of KNOWN_ADDRESSES) {
      this.coeffs[a.id] = {
        fast: randomCoeff(),
        super_fast: randomCoeff(),
        extra_fast: randomCoeff(),
      };
    }
  }

  getDeliveryRates(input: AddressLocation): DeliveryRates | null {
    const match = KNOWN_ADDRESSES.find((entry) => matchesLocation(entry, input));
    if (!match) return null;
    const c = this.coeffs[match.id];
    return {
      fast: round2(DELIVERY_BASE.fast * c.fast),
      super_fast: round2(DELIVERY_BASE.super_fast * c.super_fast),
      extra_fast: round2(DELIVERY_BASE.extra_fast * c.extra_fast),
    };
  }

  getDeliveryCost(input: AddressLocation, option: DeliveryOption): number | null {
    const rates = this.getDeliveryRates(input);
    return rates ? rates[option] : null;
  }

  search(query: string, limit = 5): AddressSuggestion[] {
    const q = normalize(query);
    if (!q) {
      return KNOWN_ADDRESSES.slice(0, limit);
    }
    const hits = KNOWN_ADDRESSES.filter((entry) => {
      const haystack = normalize(
        `${entry.description} ${entry.street} ${entry.city} ${entry.state} ${entry.country} ${entry.postalCode}`
      );
      return haystack.includes(q);
    });
    return hits.slice(0, limit);
  }

  validate(input: AddressLocation): { valid: boolean; match?: AddressSuggestion } {
    const match = KNOWN_ADDRESSES.find((entry) => matchesLocation(entry, input));
    return match ? { valid: true, match } : { valid: false };
  }

  list(): AddressSuggestion[] {
    return [...KNOWN_ADDRESSES];
  }
}
