import { ChangeEvent, useState } from 'react'
import {
  DELIVERY_FIELDS,
  DeliveryField,
  DeliveryFormErrors,
  DeliveryFormValues,
  toDeliveryInput,
  validateDeliveryForm
} from '@/lib/deliveryValidation'

export const deliveryFieldId = (field: DeliveryField): string => `delivery-${field}`

const focusFirstError = (errors: DeliveryFormErrors) => {
  const first = DELIVERY_FIELDS.find(field => errors[field])
  if (first) {
    document.getElementById(deliveryFieldId(first))?.focus()
  }
}

export const useDeliveryForm = (initialValues: DeliveryFormValues) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<DeliveryFormErrors>({})

  const setValue = (field: DeliveryField, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    // A corrected field stops showing its old error
    setErrors(current => {
      if (!current[field]) {
        return current
      }
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  // Validates on submit; returns false and highlights the invalid fields
  const validate = (): boolean => {
    const nextErrors = validateDeliveryForm(values)
    setErrors(nextErrors)
    focusFirstError(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const showErrors = (nextErrors: DeliveryFormErrors) => {
    setErrors(nextErrors)
    focusFirstError(nextErrors)
  }

  const fieldProps = (field: DeliveryField) => ({
    id: deliveryFieldId(field),
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValue(field, event.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${deliveryFieldId(field)}-error` : undefined
  })

  return { errors, validate, showErrors, fieldProps, toInput: () => toDeliveryInput(values) }
}
