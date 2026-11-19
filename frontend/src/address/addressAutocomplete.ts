export type AddressSuggestion = {
  id: string
  label: string
  city?: string
  addressLine1?: string
  postalCode?: string
  latitude?: number
  longitude?: number
}

/**
 * A provider-neutral boundary for address typeahead services.
 * Implementations must return an empty list for an empty query and honour an
 * abort signal where their transport supports it.
 */
export interface AddressAutocompleteProvider {
  suggest(query: string, options?: { signal?: AbortSignal }): Promise<AddressSuggestion[]>
}
