import { Delivery, DeliveryInput } from '@/types/order'
import { US_STATES } from './usStates'

export interface DeliveryFormValues {
  fullName: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
}

export type DeliveryField = keyof DeliveryFormValues

export type DeliveryFormErrors = Partial<Record<DeliveryField, string>>

// Order of the fields on the form, used to focus the first invalid one
export const DELIVERY_FIELDS: DeliveryField[] = ['fullName', 'email', 'phone', 'line1', 'line2', 'city', 'state', 'zip']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/

// Same rules as the server; the server stays the source of truth
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
}

const lengthError = (value: string, min: number, max: number, label: string): string | undefined => {
  const length = value.trim().length
  if (length < min) {
    return min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`
  }
  if (length > max) {
    return `${label} must be at most ${max} characters`
  }
  return undefined
}

export const validateDeliveryForm = (values: DeliveryFormValues): DeliveryFormErrors => {
  const email = values.email.trim()
  const errors: DeliveryFormErrors = {
    fullName: lengthError(values.fullName, 2, 100, 'Full name'),
    email: EMAIL_PATTERN.test(email) && email.length <= 254 ? undefined : 'Enter a valid email address',
    phone: normalizePhone(values.phone).length === 10 ? undefined : 'Enter a 10-digit US phone number',
    line1: lengthError(values.line1, 1, 100, 'Street address'),
    line2: lengthError(values.line2, 0, 50, 'Apartment'),
    city: lengthError(values.city, 1, 100, 'City'),
    state: US_STATES.some(({ code }) => code === values.state) ? undefined : 'Select a state',
    zip: ZIP_PATTERN.test(values.zip.trim()) ? undefined : 'Enter a ZIP code like 12345 or 12345-6789'
  }
  return DELIVERY_FIELDS.reduce<DeliveryFormErrors>((result, field) => {
    const message = errors[field]
    return message ? { ...result, [field]: message } : result
  }, {})
}

export const toDeliveryInput = (values: DeliveryFormValues): DeliveryInput => ({
  fullName: values.fullName.trim(),
  email: values.email.trim(),
  phone: values.phone.trim(),
  address: {
    line1: values.line1.trim(),
    line2: values.line2.trim() || null,
    city: values.city.trim(),
    state: values.state,
    zip: values.zip.trim()
  }
})

export const toDeliveryFormValues = (delivery: Delivery | null, defaultFullName: string): DeliveryFormValues =>
  delivery
    ? {
        fullName: delivery.fullName,
        email: delivery.email,
        phone: delivery.phone,
        line1: delivery.address.line1,
        line2: delivery.address.line2 ?? '',
        city: delivery.address.city,
        state: delivery.address.state,
        zip: delivery.address.zip
      }
    : { fullName: defaultFullName, email: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '' }

// Server field paths ("address.zip") to form fields ("zip")
const isDeliveryField = (field: string): field is DeliveryField => DELIVERY_FIELDS.some(known => known === field)

export const toDeliveryFormErrors = (fieldErrors: Record<string, string>): DeliveryFormErrors =>
  Object.entries(fieldErrors).reduce<DeliveryFormErrors>((result, [path, message]) => {
    const field = path.replace(/^address\./, '')
    return isDeliveryField(field) ? { ...result, [field]: message } : result
  }, {})
