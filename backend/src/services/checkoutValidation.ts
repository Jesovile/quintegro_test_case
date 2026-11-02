import { UsAddress } from '../integrations/interfaces';
import { FieldError } from '../errors/domainError';

export interface DeliveryInput {
  fullName: string;
  email: string;
  phone: string;
  address: UsAddress;
}

// 50 states and the District of Columbia
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

// US numbers are stored as 10 digits; an optional leading country code 1 is dropped
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

export const normalizeDelivery = (input: DeliveryInput): DeliveryInput => {
  const line2 = input.address.line2?.trim();

  return {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: normalizePhone(input.phone),
    address: {
      line1: input.address.line1.trim(),
      ...(line2 ? { line2 } : {}),
      city: input.address.city.trim(),
      state: input.address.state.trim().toUpperCase(),
      zip: input.address.zip.trim()
    }
  };
};

const lengthError = (field: string, value: string, min: number, max: number, label: string): FieldError[] => {
  if (value.length < min) {
    return [{ field, message: min === 1 ? `${label} is required` : `${label} must be at least ${min} characters` }];
  }
  if (value.length > max) {
    return [{ field, message: `${label} must be at most ${max} characters` }];
  }
  return [];
};

// Expects normalized input
export const validateDelivery = ({ fullName, email, phone, address }: DeliveryInput): FieldError[] => [
  ...lengthError('fullName', fullName, 2, 100, 'Full name'),
  ...(EMAIL_PATTERN.test(email) && email.length <= 254 ? [] : [{ field: 'email', message: 'Enter a valid email address' }]),
  ...(phone.length === 10 ? [] : [{ field: 'phone', message: 'Enter a 10-digit US phone number' }]),
  ...lengthError('address.line1', address.line1, 1, 100, 'Street address'),
  ...lengthError('address.line2', address.line2 ?? '', 0, 50, 'Apartment'),
  ...lengthError('address.city', address.city, 1, 100, 'City'),
  ...(US_STATE_CODES.includes(address.state) ? [] : [{ field: 'address.state', message: 'Select a state' }]),
  ...(ZIP_PATTERN.test(address.zip) ? [] : [{ field: 'address.zip', message: 'Enter a ZIP code like 12345 or 12345-6789' }])
];
