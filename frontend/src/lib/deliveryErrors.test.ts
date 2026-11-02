import { describe, expect, it } from 'vitest'
import { ApolloError } from '@apollo/client'
import { GraphQLError } from 'graphql'
import { DELIVERY_FIELDS, DeliveryFormValues, toDeliveryFormErrors, toDeliveryInput, validateDeliveryForm } from './deliveryValidation'
import { getErrorCode, getErrorMessage, getFieldErrors } from './graphqlErrors'

const empty: DeliveryFormValues = { fullName: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', zip: '' }

const withExtensions = (extensions: Record<string, unknown>) =>
  new ApolloError({ graphQLErrors: [new GraphQLError('x', { extensions })] })

describe('AC-2.1 empty form and focus order', () => {
  it('flags every required field of an empty form but not the optional apartment', () => {
    const errors = validateDeliveryForm(empty)

    expect(Object.keys(errors).sort()).toEqual(['city', 'email', 'fullName', 'line1', 'phone', 'state', 'zip'])
    expect(errors.line2).toBeUndefined()
    expect(Object.values(errors).every(Boolean)).toBe(true)
  })

  it('the first invalid field in form order is the one to focus', () => {
    const errors = validateDeliveryForm({ ...empty, fullName: 'John Doe', email: 'john@example.com', phone: 'bad' })

    expect(DELIVERY_FIELDS.find(field => errors[field])).toBe('phone')
  })

  it('accepts boundary values', () => {
    const errors = validateDeliveryForm({
      fullName: 'Jo', email: 'a@b.co', phone: '15551234567', line1: 'x'.repeat(100),
      line2: 'y'.repeat(50), city: 'c', state: 'IL', zip: '12345-6789'
    })

    expect(errors).toEqual({})
  })

  it('rejects values over the limits and an 11-digit phone not starting with 1', () => {
    const errors = validateDeliveryForm({
      ...empty, fullName: 'x'.repeat(101), email: `${'a'.repeat(250)}@b.co`, phone: '25551234567',
      line1: 'x'.repeat(101), city: 'x'.repeat(101), state: 'IL', zip: '62701'
    })

    expect(Object.keys(errors).sort()).toEqual(['city', 'email', 'fullName', 'line1', 'phone'])
  })

  it('leaves phone normalization to the server', () => {
    expect(toDeliveryInput({ ...empty, phone: ' +1 555 123 4567 ' }).phone).toBe('+1 555 123 4567')
  })
})

describe('getFieldErrors (AC-2.1, AC-2.3)', () => {
  it('returns server field errors keyed by field path', () => {
    const error = withExtensions({
      code: 'VALIDATION_FAILED',
      fields: [{ field: 'email', message: 'Bad email' }, { field: 'address.zip', message: 'Bad ZIP' }]
    })

    expect(getFieldErrors(error)).toEqual({ email: 'Bad email', 'address.zip': 'Bad ZIP' })
  })

  it('feeds the form: an address error lands on the zip field', () => {
    const error = withExtensions({ code: 'ADDRESS_REJECTED', fields: [{ field: 'address.zip', message: 'This ZIP code does not exist' }] })

    expect(toDeliveryFormErrors(getFieldErrors(error))).toEqual({ zip: 'This ZIP code does not exist' })
  })

  it('returns an empty object without fields, with malformed fields and for network errors', () => {
    expect(getFieldErrors(withExtensions({ code: 'GEO_UNAVAILABLE' }))).toEqual({})
    expect(getFieldErrors(withExtensions({ fields: 'nope' }))).toEqual({})
    expect(getFieldErrors(new ApolloError({ networkError: new Error('offline') }))).toEqual({})
  })

  it('skips malformed items and keeps valid ones', () => {
    const error = withExtensions({ fields: [null, { field: 1, message: 'a' }, { field: 'city', message: 'City is required' }, { field: 'zip' }] })

    expect(getFieldErrors(error)).toEqual({ city: 'City is required' })
  })
})

describe('Geo error messages (AC-2.3, AC-2.4)', () => {
  it('distinguishes a rejected address from an unavailable service', () => {
    const rejected = withExtensions({ code: 'ADDRESS_REJECTED' })
    const unavailable = withExtensions({ code: 'GEO_UNAVAILABLE' })

    expect(getErrorCode(unavailable)).toBe('GEO_UNAVAILABLE')
    expect(getErrorMessage(rejected)).not.toBe(getErrorMessage(unavailable))
    expect(getErrorMessage(unavailable)).toMatch(/try again/i)
    expect(getErrorMessage(rejected)).not.toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(unavailable)).not.toBe('Something went wrong. Please try again.')
  })
})
