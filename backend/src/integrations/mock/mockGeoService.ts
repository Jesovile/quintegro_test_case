import { randomUUID } from 'crypto';
import { AddressValidationResult, IGeoService, IntegrationUnavailableError, UsAddress } from '../interfaces';

// Test values that drive the mock scenarios
export const GEO_REJECTED_ZIP = '00000';
export const GEO_UNAVAILABLE_ZIP = '99999';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MockGeoService implements IGeoService {
  private addresses = new Map<string, UsAddress>();

  constructor(private delayMs = 200) {}

  async validateAddress(address: UsAddress): Promise<AddressValidationResult> {
    await wait(this.delayMs);

    if (address.zip.startsWith(GEO_UNAVAILABLE_ZIP)) {
      throw new IntegrationUnavailableError('Geo service');
    }
    if (address.zip.startsWith(GEO_REJECTED_ZIP)) {
      return { ok: false, field: 'zip', reason: 'This ZIP code does not exist' };
    }

    const addressRef = `addr_${randomUUID()}`;
    this.addresses.set(addressRef, { ...address });
    return { ok: true, addressRef };
  }

  async getAddress(addressRef: string): Promise<UsAddress | null> {
    await wait(this.delayMs);
    return this.addresses.get(addressRef) ?? null;
  }

  async deleteAddress(addressRef: string): Promise<void> {
    await wait(this.delayMs);
    this.addresses.delete(addressRef);
  }
}
