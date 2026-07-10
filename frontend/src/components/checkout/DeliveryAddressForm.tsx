import React from 'react'
import { Input } from '@/components/ui/input'
import { DeliveryAddress } from '../../context/CheckoutContext'

export type DeliveryAddressErrors = Partial<Record<keyof DeliveryAddress, string>>

interface FieldConfig {
  name: keyof DeliveryAddress
  label: string
  required: boolean
}

const FIELDS: FieldConfig[] = [
  { name: 'recipientName', label: 'Recipient full name', required: true },
  { name: 'phone', label: 'Phone number', required: true },
  { name: 'country', label: 'Country', required: true },
  { name: 'city', label: 'City', required: true },
  { name: 'street', label: 'Street', required: true },
  { name: 'building', label: 'Building', required: true },
  { name: 'apartment', label: 'Apartment/unit (optional)', required: false },
  { name: 'postalCode', label: 'Postal code', required: true }
]

interface DeliveryAddressFormProps {
  value: DeliveryAddress
  onChange: (value: DeliveryAddress) => void
  errors: DeliveryAddressErrors
}

// Fully controlled — no internal state. `CheckoutAddressPage` owns the values
// so back-navigation (AC-201-5) can re-populate the form from CheckoutContext.
const DeliveryAddressForm: React.FC<DeliveryAddressFormProps> = ({ value, onChange, errors }) => {
  const handleChange = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: e.target.value })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FIELDS.map(field => (
        <div key={field.name} className={field.name === 'street' ? 'sm:col-span-2' : ''}>
          <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-600"> *</span>}
          </label>
          <Input
            id={field.name}
            name={field.name}
            value={value[field.name] ?? ''}
            onChange={handleChange(field.name)}
            aria-invalid={!!errors[field.name]}
          />
          {errors[field.name] && (
            <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export default DeliveryAddressForm
