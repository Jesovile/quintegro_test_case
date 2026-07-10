export interface UserRecord {
  id: string;
  name: string;
}

export interface AuthRecord {
  userId: string;
  login: string;
  password: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  image: string;
}

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode: string;
}

export type DeliveryMethodType = 'regular' | 'extra';

// Snapshot stored ON the order at the moment the user picks a method — NOT a
// live reference to the catalog, so a later price change never retroactively
// changes an existing order's total. See tech-design.md §2.1.
export interface DeliveryMethodSnapshot {
  type: DeliveryMethodType;
  fee: number;
  estimatedDays: string; // e.g. "3-5" or "1-2"
}

// Catalog entry (config, not per-order) — see tech-design.md §2.2
export interface DeliveryMethodOption {
  type: DeliveryMethodType;
  label: string;
  fee: number;
  estimatedDays: string;
}

// 'paid' added by feature 4 (online payment); 'cancelled' added by feature 6 —
// see tech-design.md §2.1.
export type OrderStatus = 'created' | 'submited' | 'finished' | 'paid' | 'cancelled';

export interface OrderRecord {
  orderId: string;
  userId: string;
  status: OrderStatus;
  createAt: number;
  products: Array<{
    id: string;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;

  // NEW fields, optional because legacy orders (order-1, order-2 seed data)
  // and orders that never reached the delivery step won't have them.
  deliveryAddress?: DeliveryAddress;
  deliveryMethod?: DeliveryMethodSnapshot;

  // NEW (feature 4) — pointer to the PaymentRecord currently in effect for
  // this order (the latest succeeded attempt, or the latest attempt overall
  // if none has succeeded yet — see tech-design.md §2.3) and the timestamp a
  // successful payment set the order to 'paid'.
  paymentId?: string;
  paidAt?: number;

  // NEW (feature 6) — set when a 'paid' order is cancelled. Intentionally not
  // projected onto OrderDTO/GraphQL: no AC asks for it, see tech-design.md
  // §4.6 / implementation-plan-06.md iteration 6.1.
  cancelledAt?: number;
}

export interface OrderDTO {
  orderId: string;
  status: OrderStatus;
  products: Array<{
    product: ProductRecord;
    amount: number;
    price: number;
  }>;
  promo?: PromoEntity;
  deliveryAddress?: DeliveryAddress;
  deliveryMethod?: DeliveryMethodSnapshot;
  // NEW (feature 4) — read-model projection of the payment attempt currently
  // in effect for this order, masked to last-4. See tech-design.md §2.3.
  payment?: PaymentSummaryDTO;
  // NEW (feature 3) — computed in transformToDTO via calculateOrderTotal, not
  // a stored field; subtotal with promo applied + deliveryMethod.fee (0 if no
  // deliveryMethod yet). See tech-design.md §2.1/§4.3.
  total: number;
  // NEW (feature 5) — projected straight from OrderRecord.createAt, needed by
  // the frontend order-history sort (most-recent-first, AC-503-3). Not
  // recomputed, just passed through. See implementation-plan-05.md iter 5.3.
  createAt: number;
}

export interface PromoEntity {
  id: string;
  discount: number;
  dueDate: number;
}

// --- Payment (feature 4) — see tech-design.md §2.3 ---

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  userId: string;
  idempotencyKey: string;
  method: 'card';
  // Persisted in full, unmasked, by explicit product decision — see
  // tech-design.md §5 and docs/decisions.md. Do NOT mask/truncate these on
  // write; only the PaymentSummaryDTO read-model projection below masks.
  cardNumber: string;
  expiry: string; // as entered, e.g. "09/27" — no MM/YY split
  cvv: string;
  cardholderName: string;
  amount: number;
  status: PaymentStatus;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
}

// Read-model projection returned over GraphQL for order-history display —
// this is the ONLY place any masking happens; storage (PaymentRecord above)
// is never masked.
export interface PaymentSummaryDTO {
  paymentId: string;
  status: PaymentStatus;
  cardLast4: string;
  cardholderName: string;
  failureReason?: string;
  createdAt: number;
}
