import { PromoEntity } from '../types/entities';
import { IPromoRepository, IPromoRedemptionRepository } from '../repositories/interfaces';

export type PromoValidationError = 'Promo not found' | 'Promo expired' | 'Promo already used';

/** Promo codes are case-insensitive for customers and stored upper-case. */
export const normalizePromoCode = (code: string) => code.trim().toUpperCase();

export class PromoService {
  constructor(
    private promoRepository: IPromoRepository,
    private redemptionRepository?: IPromoRedemptionRepository
  ) {}

  /**
   * Checks that the promo exists and has not expired. When a userId is given,
   * also checks that this user has not used the code in a placed order yet.
   */
  validatePromo(promoId: string, userId?: string): { isValid: boolean; promo?: PromoEntity; error?: PromoValidationError } {
    const promo = this.promoRepository.findById(normalizePromoCode(promoId));

    if (!promo) {
      return { isValid: false, error: 'Promo not found' };
    }

    const currentTime = Date.now();
    if (currentTime > promo.dueDate) {
      return { isValid: false, error: 'Promo expired' };
    }

    if (userId && this.redemptionRepository?.has(userId, promo.id)) {
      return { isValid: false, error: 'Promo already used' };
    }

    return { isValid: true, promo };
  }

  /** Marks the promo as used by this user. Call once the order is placed. */
  redeem(userId: string, promoId: string): void {
    this.redemptionRepository?.add(userId, normalizePromoCode(promoId));
  }
}
