import { z } from 'zod';

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

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().trim().min(5, 'Phone is required'),
  country: z.string().trim().min(2, 'Country is required'),
  state: z.string().trim().min(1, 'State / region is required'),
  city: z.string().trim().min(1, 'City is required'),
  postalCode: z.string().trim().min(2, 'Postal code is required'),
  street: z.string().trim().min(2, 'Street is required'),
  apartment: z.string().trim().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const deliveryStepSchema = z
  .object({
    deliveryAddress: addressSchema,
    sameAsDelivery: z.boolean(),
    invoiceAddress: addressSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sameAsDelivery && !data.invoiceAddress) {
      ctx.addIssue({
        code: 'custom',
        path: ['invoiceAddress'],
        message: 'Invoice address is required',
      });
    }
  });

export type DeliveryStepInput = z.infer<typeof deliveryStepSchema>;

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export const paymentSchema = z
  .object({
    cardNumber: z
      .string()
      .trim()
      .refine((v) => luhnCheck(v), 'Card number is invalid'),
    cardholder: z.string().trim().min(2, 'Cardholder name is required'),
    cvv: z
      .string()
      .trim()
      .regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
    expMonth: z
      .number({ message: 'Enter a valid month (01-12)' })
      .int('Enter a valid month (01-12)')
      .min(1, 'Month must be between 01 and 12')
      .max(12, 'Month must be between 01 and 12'),
    expYear: z
      .number({ message: 'Enter a valid year' })
      .int('Enter a valid year')
      .min(currentYear, 'Card is expired')
      .max(currentYear + 20, 'Year is too far in the future'),
  })
  .superRefine((data, ctx) => {
    if (data.expYear === currentYear && data.expMonth < currentMonth) {
      ctx.addIssue({
        code: 'custom',
        path: ['expMonth'],
        message: 'Card is expired',
      });
    }
  });

export type PaymentInput = z.infer<typeof paymentSchema>;
