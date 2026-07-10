import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeliveryMethodPicker, { DeliveryMethodOption } from '../DeliveryMethodPicker'
import { DeliveryMethodType } from '../../../context/CheckoutContext'

const OPTIONS: DeliveryMethodOption[] = [
  { type: 'regular', label: 'Regular', fee: 5.99, estimatedDays: '3-5' },
  { type: 'extra', label: 'Extra', fee: 14.99, estimatedDays: '1-2' }
]

const StatefulPicker: React.FC = () => {
  const [selected, setSelected] = useState<DeliveryMethodType | null>(null)
  return <DeliveryMethodPicker options={OPTIONS} selected={selected} onSelect={setSelected} />
}

describe('DeliveryMethodPicker', () => {
  it('renders exactly 2 options (Regular, Extra), each with visible price and estimated-days text (AC-202-1)', () => {
    render(<DeliveryMethodPicker options={OPTIONS} selected={null} onSelect={vi.fn()} />)

    expect(screen.getByText('Regular')).toBeInTheDocument()
    expect(screen.getByText('$5.99')).toBeInTheDocument()
    expect(screen.getByText('3-5 days')).toBeInTheDocument()

    expect(screen.getByText('Extra')).toBeInTheDocument()
    expect(screen.getByText('$14.99')).toBeInTheDocument()
    expect(screen.getByText('1-2 days')).toBeInTheDocument()

    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('has no default selection (AC-202-2)', () => {
    render(<DeliveryMethodPicker options={OPTIONS} selected={null} onSelect={vi.fn()} />)

    screen.getAllByRole('radio').forEach(radio => {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    })
  })

  it('updates selected correctly when selecting Extra then Regular', () => {
    render(<StatefulPicker />)

    fireEvent.click(screen.getByText('Extra'))
    expect(screen.getByText('Extra').closest('button')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Regular').closest('button')).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(screen.getByText('Regular'))
    expect(screen.getByText('Regular').closest('button')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Extra').closest('button')).toHaveAttribute('aria-checked', 'false')
  })
})
