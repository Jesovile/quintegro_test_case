import type { AddressAutocompleteProvider } from './addressAutocomplete'
import { MockAddressAutocompleteProvider } from './mockAddressAutocompleteProvider'
import { PhotonAddressAutocompleteProvider } from './photonAddressAutocompleteProvider'

const providerName = import.meta.env.VITE_ADDRESS_AUTOCOMPLETE_PROVIDER ?? 'photon'

export const addressAutocompleteProvider: AddressAutocompleteProvider = providerName === 'photon'
  ? new PhotonAddressAutocompleteProvider(import.meta.env.VITE_PHOTON_BASE_URL)
  : new MockAddressAutocompleteProvider()
