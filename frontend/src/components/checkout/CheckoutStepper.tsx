import React from 'react'
import { Check } from 'lucide-react'

interface CheckoutStepperProps {
  step: 1 | 2 | 3
}

const steps = [
  { id: 1, label: 'Delivery' },
  { id: 2, label: 'Payment' },
  { id: 3, label: 'Processing' },
] as const

const CheckoutStepper: React.FC<CheckoutStepperProps> = ({ step }) => {
  return (
    <ol className="flex items-center w-full mb-8">
      {steps.map((s, idx) => {
        const done = step > s.id
        const active = step === s.id
        return (
          <li
            key={s.id}
            className={`flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`}
          >
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  done
                    ? 'bg-blue-600 text-white'
                    : active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span
                className={`ml-3 text-sm font-medium ${
                  active ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-4 ${done ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default CheckoutStepper
