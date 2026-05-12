import { OrderService, PaymentInput, SetAddressesInput } from '../services/orderService';
import { AuthService } from '../services/authService';
import { PromoService } from '../services/promoService';
import { MockGoogleAddressService } from '../services/mockGoogleAddressService';
import { Address, DeliveryOption } from '../types/entities';

const VALID_DELIVERY_OPTIONS: DeliveryOption[] = ['fast', 'super_fast', 'extra_fast'];

const luhnCheck = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\s+/g, '');
  if (!/^\d{12,19}$/.test(digits)) return false;

  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const validateAddress = (a: Address, label: string): void => {
  const required: Array<keyof Address> = ['fullName', 'phone', 'country', 'state', 'city', 'postalCode', 'street'];
  for (const key of required) {
    const value = a[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${label}.${String(key)} is required`);
    }
  }
};

const validatePayment = (input: PaymentInput): void => {
  if (!luhnCheck(input.cardNumber)) {
    throw new Error('Card number is invalid');
  }
  if (!/^\d{3,4}$/.test(input.cvv)) {
    throw new Error('CVV is invalid');
  }
  if (!input.cardholder || input.cardholder.trim().length < 2) {
    throw new Error('Cardholder name is required');
  }
  if (!Number.isInteger(input.expMonth) || input.expMonth < 1 || input.expMonth > 12) {
    throw new Error('Expiration month is invalid');
  }
  if (!Number.isInteger(input.expYear) || input.expYear < 2000 || input.expYear > 2100) {
    throw new Error('Expiration year is invalid');
  }
  const now = new Date();
  const expiry = new Date(input.expYear, input.expMonth, 1);
  if (expiry <= new Date(now.getFullYear(), now.getMonth(), 1)) {
    throw new Error('Card is expired');
  }
};

export const createResolvers = (
  orderService: OrderService,
  authService: AuthService,
  promoService: PromoService,
  addressService: MockGoogleAddressService = new MockGoogleAddressService()
) => {
  const extractUserIdFromToken = (context: any): string | null => {
    const authHeader = context.req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  };

  return {
    Query: {
      orders: async (parent: any, args: any, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          return await orderService.getOrdersByUserId(userId);
        } catch (error) {
          throw new Error('Failed to fetch orders');
        }
      },

      order: async (parent: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const order = await orderService.getOrderById(orderId, userId);
          if (!order) {
            throw new Error('Order not found or access denied');
          }
          return order;
        } catch (error) {
          throw new Error('Failed to fetch order');
        }
      },

      orderSum: async (parent: any, { orderId, products, promo }: { orderId: string, products: any[], promo?: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          return orderService.calculateOrderSum(products, promo);
        } catch (error) {
          throw new Error('Failed to calculate order sum');
        }
      },

      searchAddresses: async (parent: any, { query }: { query: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }
        return addressService.search(query);
      },

      deliveryRates: async (parent: any, { address }: { address: Address }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }
        return addressService.getDeliveryRates(address);
      },

      promo: async (parent: any, { promoId }: { promoId: string }, context: any) => {
        try {
          const validation = promoService.validatePromo(promoId);

          if (!validation.isValid) {
            if (validation.error === 'Promo not found') {
              throw new Error('Promo not found');
            } else if (validation.error === 'Promo expired') {
              throw new Error('Promo expired');
            }
          }

          return validation.promo;
        } catch (error) {
          throw new Error('Failed to fetch promo');
        }
      }
    },

    Mutation: {
      login: async (parent: any, { input }: { input: { login: string, password: string } }, context: any) => {
        try {
          const token = await authService.authenticateUser(input.login, input.password);

          if (!token) {
            throw new Error('Invalid credentials');
          }

          return { token };
        } catch (error) {
          throw new Error('Login failed');
        }
      },

      submitOrder: async (parent: any, { orderId }: { orderId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const success = await orderService.submitOrder(orderId, userId);
          if (!success) {
            throw new Error('Order not found or access denied');
          }
          return success;
        } catch (error) {
          throw new Error('Failed to submit order');
        }
      },

      deleteProductFromOrder: async (parent: any, { orderId, productId }: { orderId: string, productId: string }, context: any) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        try {
          const updatedOrder = await orderService.deleteProductFromOrder(orderId, productId, userId);
          if (!updatedOrder) {
            throw new Error('Order not found or access denied');
          }
          return updatedOrder;
        } catch (error) {
          throw new Error('Failed to delete product from order');
        }
      },

      setOrderAddresses: async (
        parent: any,
        { input }: { input: { orderId: string } & SetAddressesInput },
        context: any
      ) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        validateAddress(input.deliveryAddress, 'deliveryAddress');
        if (!input.sameAsDelivery) {
          if (!input.invoiceAddress) {
            throw new Error('Invoice address is required when sameAsDelivery is false');
          }
          validateAddress(input.invoiceAddress, 'invoiceAddress');
        }

        if (!addressService.validate(input.deliveryAddress).valid) {
          throw new Error(
            'Delivery address could not be verified by Google. Please pick a suggestion.'
          );
        }
        if (!input.sameAsDelivery && input.invoiceAddress) {
          if (!addressService.validate(input.invoiceAddress).valid) {
            throw new Error(
              'Invoice address could not be verified by Google. Please pick a suggestion.'
            );
          }
        }

        if (!VALID_DELIVERY_OPTIONS.includes(input.deliveryOption)) {
          throw new Error('Invalid delivery option');
        }

        const updated = await orderService.setOrderAddresses(input.orderId, userId, {
          deliveryAddress: input.deliveryAddress,
          invoiceAddress: input.invoiceAddress,
          sameAsDelivery: input.sameAsDelivery,
          deliveryOption: input.deliveryOption,
        });

        if (!updated) {
          throw new Error('Order not found or access denied');
        }

        return updated;
      },

      payOrder: async (
        parent: any,
        { input }: { input: { orderId: string } & PaymentInput },
        context: any
      ) => {
        const userId = extractUserIdFromToken(context);
        if (!userId) {
          throw new Error('Authentication required');
        }

        validatePayment({
          cardNumber: input.cardNumber,
          cvv: input.cvv,
          cardholder: input.cardholder,
          expMonth: input.expMonth,
          expYear: input.expYear,
        });

        const updated = await orderService.payOrder(input.orderId, userId, {
          cardNumber: input.cardNumber,
          cvv: input.cvv,
          cardholder: input.cardholder,
          expMonth: input.expMonth,
          expYear: input.expYear,
        });

        if (!updated) {
          throw new Error('Order not found or access denied');
        }

        return updated;
      }
    }
  };
};
