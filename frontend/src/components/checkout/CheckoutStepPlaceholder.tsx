import React from 'react'

interface CheckoutStepPlaceholderProps {
  title: string
  description: string
  children?: React.ReactNode
}

// Stands in for a step until its form is built in a later slice
const CheckoutStepPlaceholder: React.FC<CheckoutStepPlaceholderProps> = ({ title, description, children }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <h2 id="checkout-step-title" className="text-xl font-semibold text-gray-900 mb-2">
      {title}
    </h2>
    <p className="text-gray-600">{description}</p>
    {children}
  </div>
)

export default CheckoutStepPlaceholder
