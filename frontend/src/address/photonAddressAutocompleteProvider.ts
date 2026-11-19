import type { AddressAutocompleteProvider, AddressSuggestion } from './addressAutocomplete'

type PhotonFeature = {
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    housenumber?: string
    street?: string
    city?: string
    postcode?: string
    country?: string
  }
  geometry?: { coordinates?: [number, number] }
}

type PhotonResponse = { features?: PhotonFeature[] }

/**
 * Adapter for Photon, an OpenStreetMap-backed public typeahead API.
 * For production traffic prefer a managed service or a self-hosted Photon
 * instance; the public endpoint has no availability guarantee.
 */
export class PhotonAddressAutocompleteProvider implements AddressAutocompleteProvider {
  constructor(private readonly baseUrl = 'https://photon.komoot.io') {}

  async suggest(query: string, options?: { signal?: AbortSignal }): Promise<AddressSuggestion[]> {
    if (!query.trim()) return []

    const url = new URL('/api', this.baseUrl)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '5')
    url.searchParams.set('lang', 'en')

    const response = await fetch(url, { signal: options?.signal })
    if (!response.ok) throw new Error(`Photon returned ${response.status}`)

    const payload = await response.json() as PhotonResponse
    return (payload.features ?? []).map((feature, index) => {
      const properties = feature.properties
      const addressLine1 = [properties.street ?? properties.name, properties.housenumber].filter(Boolean).join(' ') || undefined
      const label = [addressLine1, properties.city, properties.postcode, properties.country].filter(Boolean).join(', ')
      const [longitude, latitude] = feature.geometry?.coordinates ?? []

      return {
        id: `${properties.osm_type ?? 'photon'}-${properties.osm_id ?? index}`,
        label: label || properties.name || query,
        addressLine1,
        city: properties.city,
        postalCode: properties.postcode,
        latitude,
        longitude,
      }
    })
  }
}
