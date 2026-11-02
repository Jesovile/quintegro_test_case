import { DELIVERY_FIELDS, DeliveryFormValues, toDeliveryInput, validateDeliveryForm } from '@/lib/deliveryValidation'
import { useValidatedForm } from './useValidatedForm'

export const useDeliveryForm = (initialValues: DeliveryFormValues) => {
  const form = useValidatedForm({ initialValues, fields: DELIVERY_FIELDS, idPrefix: 'delivery', validate: validateDeliveryForm })
  return { ...form, toInput: () => toDeliveryInput(form.values) }
}
