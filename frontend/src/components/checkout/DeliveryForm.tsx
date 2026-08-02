import React, { useState } from 'react'
import { DeliveryAddress } from '../../lib/checkoutTypes'
import { Input } from '../ui/input'

interface Props {
  address: DeliveryAddress
  method: 'standard' | 'express'
  onAddressChange: (address: DeliveryAddress) => void
  onMethodChange: (method: 'standard' | 'express') => void
}

const DeliveryForm: React.FC<Props> = ({ address, method, onAddressChange, onMethodChange }) => {
  const [touched, setTouched] = useState<Partial<Record<keyof DeliveryAddress, boolean>>>({})
  const change = (field: keyof DeliveryAddress) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(current => ({ ...current, [field]: true }))
    onAddressChange({ ...address, [field]: event.target.value })
  }
  const markTouched = (field: keyof DeliveryAddress) => () => setTouched(current => ({ ...current, [field]: true }))
  const errorFor = (field: keyof DeliveryAddress) => touched[field] && !address[field].trim() ? 'This field is required' : undefined
  const inputClass = (field: keyof DeliveryAddress) => errorFor(field) ? 'border-red-500 focus-visible:ring-red-500' : undefined
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Delivery</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1" htmlFor="delivery-recipient">
        <span>Recipient <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="delivery-recipient" placeholder="Recipient" value={address.fullName} onChange={change('fullName')} onBlur={markTouched('fullName')} required aria-invalid={Boolean(errorFor('fullName'))} aria-describedby={errorFor('fullName') ? 'delivery-recipient-error' : undefined} className={inputClass('fullName')} />
        {errorFor('fullName') && <p id="delivery-recipient-error" role="alert" className="text-sm text-red-600">{errorFor('fullName')}</p>}
      </label>
      <label className="space-y-1" htmlFor="delivery-street">
        <span>Street address <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="delivery-street" placeholder="Street, building, apartment" value={address.street} onChange={change('street')} onBlur={markTouched('street')} required aria-invalid={Boolean(errorFor('street'))} aria-describedby={errorFor('street') ? 'delivery-street-error' : undefined} className={inputClass('street')} />
        {errorFor('street') && <p id="delivery-street-error" role="alert" className="text-sm text-red-600">{errorFor('street')}</p>}
      </label>
      <label className="space-y-1" htmlFor="delivery-city">
        <span>City <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="delivery-city" placeholder="City" value={address.city} onChange={change('city')} onBlur={markTouched('city')} required aria-invalid={Boolean(errorFor('city'))} aria-describedby={errorFor('city') ? 'delivery-city-error' : undefined} className={inputClass('city')} />
        {errorFor('city') && <p id="delivery-city-error" role="alert" className="text-sm text-red-600">{errorFor('city')}</p>}
      </label>
      <label className="space-y-1" htmlFor="delivery-postal-code">
        <span>Postal code <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="delivery-postal-code" placeholder="Postal code" value={address.postalCode} onChange={change('postalCode')} onBlur={markTouched('postalCode')} required aria-invalid={Boolean(errorFor('postalCode'))} aria-describedby={errorFor('postalCode') ? 'delivery-postal-code-error' : undefined} className={inputClass('postalCode')} />
        {errorFor('postalCode') && <p id="delivery-postal-code-error" role="alert" className="text-sm text-red-600">{errorFor('postalCode')}</p>}
      </label>
      <label className="space-y-1" htmlFor="delivery-country">
        <span>Country <span aria-hidden="true" className="text-red-600">*</span></span>
        <Input id="delivery-country" placeholder="Country" value={address.country} onChange={change('country')} onBlur={markTouched('country')} required aria-invalid={Boolean(errorFor('country'))} aria-describedby={errorFor('country') ? 'delivery-country-error' : undefined} className={inputClass('country')} />
        {errorFor('country') && <p id="delivery-country-error" role="alert" className="text-sm text-red-600">{errorFor('country')}</p>}
      </label>
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
