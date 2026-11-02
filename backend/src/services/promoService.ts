import { PromoEntity } from '../types/entities';
import { IPromoRepository } from '../repositories/interfaces';
import { DomainError } from '../errors/domainError';

export type PromoCheck =
  | { ok: true; promo: PromoEntity }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' };

export const isPromoActive = (promo: PromoEntity, now = Date.now()): boolean => now <= promo.dueDate;

export class PromoService {
  constructor(private promoRepository: IPromoRepository) {}

  // Codes match exactly, as entered (surrounding spaces aside)
  checkPromo(code: string): PromoCheck {
    const promo = this.promoRepository.findById(code.trim());

    if (!promo) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (!isPromoActive(promo)) {
      return { ok: false, reason: 'EXPIRED' };
    }
    return { ok: true, promo };
  }

  getActivePromo(code: string): PromoEntity {
    const check = this.checkPromo(code);

    if (!check.ok) {
      throw check.reason === 'EXPIRED'
        ? new DomainError('PROMO_EXPIRED', 'This promo code has expired')
        : new DomainError('PROMO_NOT_FOUND', 'This promo code does not exist');
    }
    return check.promo;
  }
}
