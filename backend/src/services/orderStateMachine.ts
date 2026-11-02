import { OrderStatus } from '../types/entities';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['checkout'],
  checkout: ['created', 'paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['deliver', 'cancelled'],
  deliver: [],
  cancelled: []
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from].includes(to);
