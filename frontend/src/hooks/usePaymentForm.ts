import { CARD_FIELDS, EMPTY_CARD, validateCardForm } from '@/lib/cardValidation'
import { useValidatedForm } from './useValidatedForm'

// Card data lives only in this form state: it is never stored, logged or sent to our API
export const usePaymentForm = () =>
  useValidatedForm({ initialValues: EMPTY_CARD, fields: CARD_FIELDS, idPrefix: 'card', validate: (values) => validateCardForm(values) })
