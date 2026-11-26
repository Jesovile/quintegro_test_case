import { CheckoutInput } from '../types/dtos';
import { CheckoutValidationError } from '../errors/checkoutError';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CheckoutValidationError('Customer information and credit card details are required');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new CheckoutValidationError(`${field} is required and must be at most ${maxLength} characters`);
  }
  return value.trim();
}

function validCardNumber(number: string): boolean {
  if (!/^\d{13,19}$/.test(number)) return false;
  let sum = 0;
  let double = false;
  for (let index = number.length - 1; index >= 0; index--) {
    let digit = Number(number[index]);
    if (double) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
    double = !double;
  }
  return !/^0+$/.test(number) && sum % 10 === 0;
}

export function validateCheckout(input: unknown, now = new Date()): CheckoutInput {
  const request = object(input);
  const customer = object(request.customer);
  const card = object(request.creditCard);
  const normalizedCustomer = {
    firstName: text(customer.firstName, 'First name', 100),
    lastName: text(customer.lastName, 'Last name', 100),
    email: text(customer.email, 'Email', 254),
    phone: text(customer.phone, 'Phone', 40),
    address: text(customer.address, 'Address', 1000),
    zipcode: text(customer.zipcode, 'ZIP code', 10)
  };
  if (!/^\d{5}(-\d{4})?$/.test(normalizedCustomer.zipcode)) {
    throw new CheckoutValidationError('ZIP code must contain 5 digits or use ZIP+4 format');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCustomer.email)) {
    throw new CheckoutValidationError('Email must be a valid email address');
  }
  if (!/^\+?[\d\s().-]+$/.test(normalizedCustomer.phone)
    || !/^\d{7,15}$/.test(normalizedCustomer.phone.replace(/\D/g, ''))) {
    throw new CheckoutValidationError('Phone must contain 7 to 15 digits');
  }
  const creditCard = {
    cardholderName: text(card.cardholderName, 'Cardholder name', 100),
    number: text(card.number, 'Card number', 40).replace(/[ -]/g, ''),
    expiryMonth: card.expiryMonth as number,
    expiryYear: card.expiryYear as number,
    securityCode: text(card.securityCode, 'Security code', 4)
  };
  if (!validCardNumber(creditCard.number)) {
    throw new CheckoutValidationError('Card number is invalid');
  }
  const { expiryMonth, expiryYear } = creditCard;
  if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12
    || !Number.isInteger(expiryYear) || expiryYear > 9999
    || expiryYear < now.getUTCFullYear()
    || (expiryYear === now.getUTCFullYear() && expiryMonth < now.getUTCMonth() + 1)) {
    throw new CheckoutValidationError('Card expiry is invalid or expired');
  }
  if (!/^\d{3,4}$/.test(creditCard.securityCode)) {
    throw new CheckoutValidationError('Security code must contain 3 or 4 digits');
  }
  return { customer: normalizedCustomer, creditCard };
}
