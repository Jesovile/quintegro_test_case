import React from 'react'
import { cn } from '@/lib/utils'
import { DeliveryMethodType } from '../../context/CheckoutContext'

export interface DeliveryMethodOption {
  type: DeliveryMethodType
  label: string
  fee: number
  estimatedDays: string
}

interface DeliveryMethodPickerProps {
  options: DeliveryMethodOption[]
  selected: DeliveryMethodType | null
  onSelect: (type: DeliveryMethodType) => void
}

// No default selection — `selected` starts `null`, matching AC-202-2's
// "no silent default." Rendered as two selectable cards/radio options.
const DeliveryMethodPicker: React.FC<DeliveryMethodPickerProps> = ({ options, selected, onSelect }) => {
  return (
    <div role="radiogroup" aria-label="Delivery method" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map(option => {
        const isSelected = selected === option.type
        return (
          <button
            key={option.type}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.type)}
            className={cn(
              'text-left rounded-lg border p-4 shadow-sm transition-colors',
              isSelected ? 'border-blue-600 ring-2 ring-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <div className="font-semibold text-gray-900">{option.label}</div>
            <div className="text-sm text-gray-600 mt-1">{option.estimatedDays} days</div>
            <div className="text-lg font-bold text-gray-900 mt-2">${option.fee.toFixed(2)}</div>
          </button>
        )
      })}
    </div>
  )
}

export default DeliveryMethodPicker
