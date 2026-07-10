import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeliveryAddressForm from '../DeliveryAddressForm'
import { DeliveryAddress } from '../../../context/CheckoutContext'

const EMPTY_ADDRESS: DeliveryAddress = {
  recipientName: '',
  phone: '',
  country: '',
  city: '',
  street: '',
  building: '',
  apartment: '',
  postalCode: ''
}

// Controlled wrapper so typing round-trips through onChange -> value, the way
// CheckoutAddressPage actually uses this component.
const ControlledForm: React.FC<{ errors?: Partial<Record<keyof DeliveryAddress, string>> }> = ({ errors = {} }) => {
  const [value, setValue] = useState<DeliveryAddress>(EMPTY_ADDRESS)
  return <DeliveryAddressForm value={value} onChange={setValue} errors={errors} />
}

describe('DeliveryAddressForm', () => {
  it('renders empty required fields (recipientName, phone, country, city, street, building, postalCode) and one optional field (apartment) on first load (AC-201-1)', () => {
    render(<DeliveryAddressForm value={EMPTY_ADDRESS} onChange={vi.fn()} errors={{}} />)

    const requiredLabels = [
      /recipient full name/i,
      /phone number/i,
      /^country/i,
      /^city/i,
      /^street/i,
      /^building/i,
      /postal code/i
    ]
    requiredLabels.forEach(label => {
      const input = screen.getByLabelText(label) as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('')
    })

    const optional = screen.getByLabelText(/apartment\/unit \(optional\)/i) as HTMLInputElement
    expect(optional).toBeInTheDocument()
    expect(optional.value).toBe('')
  })

  it('updates the controlled value and reflects it back in the input when typing', () => {
    render(<ControlledForm />)

    const nameInput = screen.getByLabelText(/recipient full name/i) as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } })

    expect(nameInput.value).toBe('Jane Doe')
  })

  it('renders an inline error only next to the field with an error', () => {
    render(<DeliveryAddressForm value={EMPTY_ADDRESS} onChange={vi.fn()} errors={{ phone: 'Invalid format' }} />)

    expect(screen.getByText('Invalid format')).toBeInTheDocument()

    // Only one error message rendered in total
    expect(screen.getAllByText('Invalid format')).toHaveLength(1)
  })
})
