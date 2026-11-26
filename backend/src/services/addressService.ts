import { AddressRecord } from '../types/entities';
import { IAddressRepository } from '../repositories/interfaces';

export const MAX_ADDRESS_RESULTS = 20;
const DEFAULT_ADDRESS_RESULTS = 8;

export class AddressService {
  constructor(private addressRepository: IAddressRepository) {}

  /**
   * Case-insensitive search over "line1, city, state zip".
   * Every word of the query must appear somewhere in the address, so
   * "university menlo", "94025" and "main st oh" all match.
   * An empty query returns the first addresses, so an opened select is never empty.
   */
  search(query: string, limit: number = DEFAULT_ADDRESS_RESULTS): AddressRecord[] {
    const tokens = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const safeLimit = Math.max(1, Math.min(MAX_ADDRESS_RESULTS, Math.floor(limit)));

    return this.addressRepository
      .findAll()
      .filter(address => {
        const haystack = `${address.line1}, ${address.city}, ${address.state} ${address.zip}`.toLowerCase();
        return tokens.every(token => haystack.includes(token));
      })
      .slice(0, safeLimit);
  }
}
