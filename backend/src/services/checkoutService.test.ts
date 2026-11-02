import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryOrderRepository, InMemoryProductRepository, InMemoryPromoRepository } from '../repositories/implementations';
import { PromoService } from './promoService';
import { AddressValidationResult, IGeoService, UsAddress } from '../integrations/interfaces';
import { MockGeoService } from '../integrations/mock/mockGeoService';
import { OrderService } from './orderService';
import { CheckoutService } from './checkoutService';

const input = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '5551234567',
  address: { line1: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }
};

const setup = (geo: IGeoService, timeoutMs = 50) => {
  const orders = new InMemoryOrderRepository();
  const promos = new PromoService(new InMemoryPromoRepository());
  const service = new CheckoutService(orders, new OrderService(orders, new InMemoryProductRepository()), geo, promos, timeoutMs);
  return { orders, service };
};

describe('saveDelivery and the Geo service', () => {
  let geo: MockGeoService;
  let orders: InMemoryOrderRepository;
  let service: CheckoutService;

  beforeEach(async () => {
    geo = new MockGeoService(0);
    ({ orders, service } = setup(geo));
    await service.startCheckout('order-2', 'user-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not check the address again when the same data is saved twice', async () => {
    const validate = vi.spyOn(geo, 'validateAddress');

    await service.saveDelivery('order-2', 'user-1', input);
    const firstRef = orders.findById('order-2')?.addressRef;
    await service.saveDelivery('order-2', 'user-1', { ...input, phone: '(555) 123-4567' });

    expect(validate).toHaveBeenCalledTimes(1);
    expect(orders.findById('order-2')?.addressRef).toBe(firstRef);
  });

  it('deletes the previous address when the address changes', async () => {
    await service.saveDelivery('order-2', 'user-1', input);
    const oldRef = orders.findById('order-2')!.addressRef!;

    await service.saveDelivery('order-2', 'user-1', { ...input, address: { ...input.address, line1: '2 Main St' } });

    expect(orders.findById('order-2')?.addressRef).not.toBe(oldRef);
    expect(await geo.getAddress(oldRef)).toBeNull();
  });

  it('deletes the new address when the order left checkout during the check', async () => {
    const deleteAddress = vi.spyOn(geo, 'deleteAddress');
    const saving = service.saveDelivery('order-2', 'user-1', input);
    await service.exitCheckout('order-2', 'user-1');

    await expect(saving).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    expect(deleteAddress).toHaveBeenCalledTimes(1);
  });

  it('reports a missing saved address instead of an empty delivery', async () => {
    await service.saveDelivery('order-2', 'user-1', input);
    await geo.deleteAddress(orders.findById('order-2')!.addressRef!);

    await expect(service.getDelivery('order-2')).rejects.toMatchObject({ code: 'ADDRESS_NOT_FOUND' });
  });
});

describe('Geo service failures', () => {
  const hangingGeo: IGeoService = {
    validateAddress: () => new Promise<AddressValidationResult>(() => undefined),
    getAddress: () => new Promise<UsAddress | null>(() => undefined),
    deleteAddress: async () => undefined
  };

  it('turns a hanging call into GEO_UNAVAILABLE after the timeout', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { service } = setup(hangingGeo, 20);
    await service.startCheckout('order-2', 'user-1');

    await expect(service.saveDelivery('order-2', 'user-1', input)).rejects.toMatchObject({ code: 'GEO_UNAVAILABLE' });
  });

  it('does not hide a programming error as an outage', async () => {
    const brokenGeo: IGeoService = { ...hangingGeo, validateAddress: async () => { throw new TypeError('bug'); } };
    const { service } = setup(brokenGeo);
    await service.startCheckout('order-2', 'user-1');

    await expect(service.saveDelivery('order-2', 'user-1', input)).rejects.toBeInstanceOf(TypeError);
  });
});
