import { IPromoRepository } from '../repositories/interfaces';

export class PricingService {
  constructor(private promoRepository: IPromoRepository) {}

  calculateOrderSum(products: Array<{ id: string; amount: number; price: number }>, promoId?: string): number {
    // Убрать promo
    const subtotal = products.reduce((sum, p) => sum + p.amount * p.price, 0);
    if (!promoId) return subtotal;

    const promo = this.promoRepository.findById(promoId);
    if (!promo || Date.now() > promo.dueDate) return subtotal;

    return subtotal - (subtotal * promo.discount) / 100;
  }
}
