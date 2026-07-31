import React from 'react'
import { DeliveryAddress } from '../../lib/checkoutTypes'
import { Input } from '../ui/input'

interface Props {
  address: DeliveryAddress
  method: 'standard' | 'express'
  onAddressChange: (address: DeliveryAddress) => void
  onMethodChange: (method: 'standard' | 'express') => void
}

const DeliveryForm: React.FC<Props> = ({ address, method, onAddressChange, onMethodChange }) => {
  const change = (field: keyof DeliveryAddress) => (event: React.ChangeEvent<HTMLInputElement>) => onAddressChange({ ...address, [field]: event.target.value })
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Delivery</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <Input aria-label="Recipient" placeholder="Recipient" value={address.fullName} onChange={change('fullName')} />
      <Input aria-label="Street address" placeholder="Street, building, apartment" value={address.street} onChange={change('street')} />
      <Input aria-label="City" placeholder="City" value={address.city} onChange={change('city')} />
      <Input aria-label="Postal code" placeholder="Postal code" value={address.postalCode} onChange={change('postalCode')} />
      <Input aria-label="Country" placeholder="Country" value={address.country} onChange={change('country')} />
    </div>
    <div className="flex gap-3" role="radiogroup" aria-label="Delivery method">
      {(['standard', 'express'] as const).map(value => <label key={value} className="flex items-center gap-2 rounded border p-3">
        <input type="radio" name="delivery" checked={method === value} onChange={() => onMethodChange(value)} />
        {value === 'standard' ? 'Standard' : 'Express'}
      </label>)}
    </div>
  </section>
}

export default DeliveryForm
