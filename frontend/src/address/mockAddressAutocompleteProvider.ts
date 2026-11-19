import type { AddressAutocompleteProvider, AddressSuggestion } from './addressAutocomplete'

const addresses: AddressSuggestion[] = [
  { id: 'mock-1', label: 'Kralja Milana 10, Beograd 11000, Srbija', addressLine1: 'Kralja Milana 10', city: 'Beograd', postalCode: '11000', latitude: 44.8071, longitude: 20.4612 },
  { id: 'mock-2', label: 'Bulevar kralja Aleksandra 73, Beograd 11000, Srbija', addressLine1: 'Bulevar kralja Aleksandra 73', city: 'Beograd', postalCode: '11000', latitude: 44.8023, longitude: 20.4783 },
  { id: 'mock-3', label: 'Zmaj Jovina 22, Novi Sad 21000, Srbija', addressLine1: 'Zmaj Jovina 22', city: 'Novi Sad', postalCode: '21000', latitude: 45.2554, longitude: 19.8455 },
]

/** Local deterministic provider for development and automated checks. */
export class MockAddressAutocompleteProvider implements AddressAutocompleteProvider {
  async suggest(query: string): Promise<AddressSuggestion[]> {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []

    return addresses.filter(address => address.label.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 5)
  }
}
