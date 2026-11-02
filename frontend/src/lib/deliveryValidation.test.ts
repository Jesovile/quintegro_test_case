import { describe, expect, it } from 'vitest'
import { DeliveryFormValues, toDeliveryFormErrors, toDeliveryInput, toDeliveryFormValues, validateDeliveryForm } from './deliveryValidation'

const valid: DeliveryFormValues = {
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '(555) 123-4567',
  line1: '1 Main St',
  line2: '',
  city: 'Springfield',
  state: 'IL',
  zip: '62701'
}

describe('delivery form validation (AC-2.1)', () => {
  it('accepts a valid US address', () => {
    expect(validateDeliveryForm(valid)).toEqual({})
  })

  it('reports every invalid field', () => {
    const errors = validateDeliveryForm({
      fullName: 'J',
      email: 'john@',
      phone: '12345',
      line1: ' ',
      line2: 'x'.repeat(51),
      city: '',
      state: 'XX',
      zip: '1234'
    })

    expect(Object.keys(errors).sort()).toEqual(['city', 'email', 'fullName', 'line1', 'line2', 'phone', 'state', 'zip'])
  })

  it('accepts a phone with the country code and a ZIP+4', () => {
    expect(validateDeliveryForm({ ...valid, phone: '+1 555 123 4567', zip: '62701-1234' })).toEqual({})
  })
})

describe('delivery form mapping', () => {
  it('trims values and sends an empty apartment as null', () => {
    expect(toDeliveryInput({ ...valid, fullName: '  John Doe ', line2: '  ' }).address.line2).toBeNull()
    expect(toDeliveryInput({ ...valid, fullName: '  John Doe ' }).fullName).toBe('John Doe')
  })

  it('prefills the name when nothing is saved yet (AC-2.5)', () => {
    expect(toDeliveryFormValues(null, 'John Doe')).toMatchObject({ fullName: 'John Doe', email: '', state: '' })
  })

  it('maps server field paths to form fields', () => {
    expect(toDeliveryFormErrors({ 'address.zip': 'Bad ZIP', email: 'Bad email', unknown: 'x' })).toEqual({
      zip: 'Bad ZIP',
      email: 'Bad email'
    })
  })
})
