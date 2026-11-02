import { describe, expect, it } from 'vitest';
import { GEO_REJECTED_ZIP, GEO_UNAVAILABLE_ZIP, MockGeoService } from './mock/mockGeoService';
import { IntegrationUnavailableError, UsAddress } from './interfaces';

const address: UsAddress = { line1: '1 Main St', line2: '2', city: 'Springfield', state: 'IL', zip: '62701' };

describe('MockGeoService contract (AC-2.2 - AC-2.4)', () => {
  it('accepts an address and returns a reference that restores it', async () => {
    const geo = new MockGeoService(0);
    const result = await geo.validateAddress(address);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.addressRef).toMatch(/^addr_/);
    expect(await geo.getAddress(result.addressRef)).toEqual(address);
  });

  it('returns distinct references for each validation', async () => {
    const geo = new MockGeoService(0);
    const a = await geo.validateAddress(address);
    const b = await geo.validateAddress(address);

    expect(a.ok && b.ok && a.addressRef !== b.addressRef).toBe(true);
  });

  it('rejects the test ZIP with a field and a reason', async () => {
    const result = await new MockGeoService(0).validateAddress({ ...address, zip: GEO_REJECTED_ZIP });

    expect(result).toMatchObject({ ok: false, field: 'zip' });
    expect(result.ok === false && result.reason).toBeTruthy();
  });

  it('is unavailable for the outage ZIP, including ZIP+4', async () => {
    const geo = new MockGeoService(0);

    await expect(geo.validateAddress({ ...address, zip: GEO_UNAVAILABLE_ZIP })).rejects.toBeInstanceOf(IntegrationUnavailableError);
    await expect(geo.validateAddress({ ...address, zip: `${GEO_UNAVAILABLE_ZIP}-1234` })).rejects.toBeInstanceOf(IntegrationUnavailableError);
  });

  it('returns null for unknown references', async () => {
    expect(await new MockGeoService(0).getAddress('addr_unknown')).toBeNull();
  });

  it('is asynchronous', () => {
    expect(new MockGeoService(0).validateAddress(address)).toBeInstanceOf(Promise);
  });
});
