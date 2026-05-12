import React from 'react'
import { Truck, Zap, Rocket } from 'lucide-react'

export type DeliveryOption = 'fast' | 'super_fast' | 'extra_fast'

interface DeliveryRates {
  fast: number
  super_fast: number
  extra_fast: number
}

interface DeliveryOptionsProps {
  value: DeliveryOption
  onChange: (next: DeliveryOption) => void
  rates?: DeliveryRates | null
  loading?: boolean
  disabled?: boolean
}

const OPTIONS: Array<{
  key: DeliveryOption
  label: string
  Icon: typeof Truck
  hint: string
}> = [
  { key: 'fast', label: 'Fast', Icon: Truck, hint: '5–7 business days' },
  { key: 'super_fast', label: 'Super Fast', Icon: Zap, hint: '2–3 business days' },
  { key: 'extra_fast', label: 'Extra Fast', Icon: Rocket, hint: 'Next business day' },
]

const formatPrice = (v?: number) => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—')

const DeliveryOptions: React.FC<DeliveryOptionsProps> = ({
  value,
  onChange,
  rates,
  loading,
  disabled,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Delivery option</h2>
        {loading && <span className="text-xs text-gray-500">Loading rates…</span>}
      </div>

      {!rates && !loading && (
        <p className="text-sm text-gray-500">
          Pick a verified delivery address above to see rates.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const price = rates?.[opt.key]
          const checked = value === opt.key
          const interactable = !disabled && !!rates
          return (
            <label
              key={opt.key}
              className={`flex flex-col gap-2 cursor-pointer rounded-lg border p-4 transition-colors ${
                checked
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              } ${!interactable ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <opt.Icon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                </div>
                <input
                  type="radio"
                  name="delivery-option"
                  value={opt.key}
                  checked={checked}
                  onChange={() => onChange(opt.key)}
                  disabled={!interactable}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <span className="text-xs text-gray-500">{opt.hint}</span>
              <span className="text-base font-semibold text-gray-900">{formatPrice(price)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default DeliveryOptions
