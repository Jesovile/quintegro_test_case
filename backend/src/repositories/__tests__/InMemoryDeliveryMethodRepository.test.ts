import { describe, it, expect } from 'vitest';
import { InMemoryDeliveryMethodRepository } from '../implementations';

describe('InMemoryDeliveryMethodRepository', () => {
  it('findAll returns exactly the two seeded options (Regular, Extra)', () => {
    const repo = new InMemoryDeliveryMethodRepository();
    const options = repo.findAll();

    expect(options).toHaveLength(2);
    expect(options.map(o => o.type).sort()).toEqual(['extra', 'regular']);
  });

  it("findByType('regular') returns the seeded Regular snapshot", () => {
    const repo = new InMemoryDeliveryMethodRepository();
    const regular = repo.findByType('regular');

    expect(regular).toEqual({ type: 'regular', label: 'Regular', fee: 5.99, estimatedDays: '3-5' });
  });

  it("findByType('extra') returns the seeded Extra snapshot", () => {
    const repo = new InMemoryDeliveryMethodRepository();
    const extra = repo.findByType('extra');

    expect(extra).toEqual({ type: 'extra', label: 'Extra', fee: 14.99, estimatedDays: '1-2' });
  });

  it('findByType with an invalid value returns undefined', () => {
    const repo = new InMemoryDeliveryMethodRepository();
    // @ts-expect-error - intentionally passing an invalid DeliveryMethodType to test the guard
    const result = repo.findByType('overnight');

    expect(result).toBeUndefined();
  });
});
