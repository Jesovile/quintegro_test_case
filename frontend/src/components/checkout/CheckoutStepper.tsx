import React from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { CHECKOUT_STEPS, checkoutPath, getAvailableSteps, stepIndex } from '@/lib/checkoutSteps'
import { CheckoutStep, Order } from '@/types/order'

interface CheckoutStepperProps {
  order: Order
  currentStep: CheckoutStep
}

const CheckoutStepper: React.FC<CheckoutStepperProps> = ({ order, currentStep }) => {
  const available = getAvailableSteps(order)

  return (
    <nav aria-label="Checkout progress" className="mb-6">
      <ol className="flex flex-wrap gap-x-6 gap-y-2">
        {CHECKOUT_STEPS.map(({ id, label }, index) => {
          const isCurrent = id === currentStep
          const isDone = stepIndex(id) < stepIndex(currentStep)
          const content = (
            <>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isCurrent ? 'bg-blue-600 text-white' : isDone ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span>{label}</span>
              {isDone && <span className="sr-only">(completed)</span>}
            </>
          )

          return (
            <li key={id}>
              {!isCurrent && available.includes(id) ? (
                <Link
                  to={checkoutPath(order.orderId, id)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-2 text-sm font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default CheckoutStepper
