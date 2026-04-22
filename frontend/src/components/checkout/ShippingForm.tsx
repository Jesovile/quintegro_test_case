import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Shipping } from '../../types/order'

interface Props {
  initial?: Shipping | null
  busy?: boolean
  onBack: () => void
  onSubmit: (shipping: Shipping) => Promise<void> | void
  onCancel: () => void
}

const EMPTY: Shipping = {
  fullName: '',
  address: '',
  city: '',
  zip: '',
  country: '',
  phone: ''
}

const FIELDS: { key: keyof Shipping; label: string; placeholder: string }[] = [
  { key: 'fullName', label: 'Full name', placeholder: 'Jane Doe' },
  { key: 'address', label: 'Address', placeholder: '123 Main St' },
  { key: 'city', label: 'City', placeholder: 'Springfield' },
  { key: 'zip', label: 'ZIP / Postal code', placeholder: '12345' },
  { key: 'country', label: 'Country', placeholder: 'US' },
  { key: 'phone', label: 'Phone', placeholder: '+1 555 0100' }
]

const ShippingForm: React.FC<Props> = ({ initial, busy, onBack, onSubmit, onCancel }) => {
  const [form, setForm] = useState<Shipping>(initial ?? EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Shipping, string>>>({})

  const validate = (): boolean => {
    const next: Partial<Record<keyof Shipping, string>> = {}
    FIELDS.forEach(f => {
      if (!form[f.key].trim()) next[f.key] = 'Required'
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleChange = (key: keyof Shipping) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold mb-6 text-gray-900">Shipping address</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{f.label}</label>
            <Input
              value={form[f.key]}
              onChange={handleChange(f.key)}
              placeholder={f.placeholder}
              disabled={busy}
              className="h-10"
            />
            {errors[f.key] && <p className="text-xs text-red-600">{errors[f.key]}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="text-red-600 hover:bg-red-50"
        >
          Cancel order
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button
            type="submit"
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
          >
            {busy ? 'Saving...' : 'Next: Payment'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default ShippingForm
