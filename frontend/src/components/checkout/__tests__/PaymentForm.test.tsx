import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PaymentForm from '../PaymentForm'

const VALID_CARD = {
  cardNumber: '4242424242424242',
  expiry: '09/30',
  cvv: '123',
  cardholderName: 'Jane Doe'
}

function fillCard(overrides: Partial<typeof VALID_CARD> = {}) {
  const card = { ...VALID_CARD, ...overrides }
  fireEvent.change(screen.getByLabelText(/card number/i), { target: { value: card.cardNumber } })
  fireEvent.change(screen.getByLabelText(/expiry/i), { target: { value: card.expiry } })
  fireEvent.change(screen.getByLabelText(/cvv/i), { target: { value: card.cvv } })
  fireEvent.change(screen.getByLabelText(/cardholder name/i), { target: { value: card.cardholderName } })
}

describe('PaymentForm', () => {
  it('renders four empty fields on mount (AC-401-1)', () => {
    render(<PaymentForm onSubmit={() => {}} disabled={false} />)

    expect((screen.getByLabelText(/card number/i) as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText(/expiry/i) as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText(/cvv/i) as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText(/cardholder name/i) as HTMLInputElement).value).toBe('')
  })

  it('entering "123" as card number and submitting shows a field-level error, onSubmit not called (AC-401-2)', () => {
    const onSubmit = vi.fn()
    render(<PaymentForm onSubmit={onSubmit} disabled={false} />)

    fillCard({ cardNumber: '123' })
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(screen.getByText(/valid card number/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('entering an expiry in the past shows a field-level error, onSubmit not called (AC-401-3)', () => {
    const onSubmit = vi.fn()
    render(<PaymentForm onSubmit={onSubmit} disabled={false} />)

    fillCard({ expiry: '01/20' })
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(screen.getByText(/expiry date is in the past/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('entering all-valid fields and submitting calls onSubmit with the exact CardInput shape (AC-401-4)', () => {
    const onSubmit = vi.fn()
    render(<PaymentForm onSubmit={onSubmit} disabled={false} />)

    fillCard()
    fireEvent.click(screen.getByRole('button', { name: /pay/i }))

    expect(onSubmit).toHaveBeenCalledWith(VALID_CARD)
  })

  it('disabled={true} renders all inputs and the submit button as disabled', () => {
    render(<PaymentForm onSubmit={() => {}} disabled={true} />)

    expect(screen.getByLabelText(/card number/i)).toBeDisabled()
    expect(screen.getByLabelText(/expiry/i)).toBeDisabled()
    expect(screen.getByLabelText(/cvv/i)).toBeDisabled()
    expect(screen.getByLabelText(/cardholder name/i)).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
