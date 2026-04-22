import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CheckoutStep = 'review' | 'shipping' | 'payment' | 'confirm'

export const STEP_ORDER: CheckoutStep[] = ['review', 'shipping', 'payment', 'confirm']

const LABEL: Record<CheckoutStep, string> = {
  review: 'Review',
  shipping: 'Shipping',
  payment: 'Payment',
  confirm: 'Confirm'
}

interface Props {
  current: CheckoutStep
}

const CheckoutStepper: React.FC<Props> = ({ current }) => {
  const currentIdx = STEP_ORDER.indexOf(current)

  return (
    <ol className="flex items-center justify-between mb-8">
      {STEP_ORDER.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        return (
          <li key={step} className="flex-1 flex items-center">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full border text-sm font-medium',
                  done && 'bg-blue-600 text-white border-blue-600',
                  active && 'bg-white text-blue-700 border-blue-600',
                  !done && !active && 'bg-gray-100 text-gray-500 border-gray-200'
                )}
              >
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  active ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {LABEL[step]}
              </span>
            </div>
            {idx < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-4',
                  idx < currentIdx ? 'bg-blue-600' : 'bg-gray-200'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default CheckoutStepper
