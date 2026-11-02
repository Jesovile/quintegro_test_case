import { ChangeEvent, useState } from 'react'

export type FormErrors<Field extends string> = Partial<Record<Field, string>>

interface ValidatedFormOptions<Field extends string> {
  initialValues: Record<Field, string>
  // Field order on the screen, used to focus the first invalid one
  fields: Field[]
  idPrefix: string
  validate: (values: Record<Field, string>) => FormErrors<Field>
}

// Shared mechanics of the checkout forms: values, validation on submit, highlighted fields, focus on the first error
export const useValidatedForm = <Field extends string>({ initialValues, fields, idPrefix, validate }: ValidatedFormOptions<Field>) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FormErrors<Field>>({})

  const fieldId = (field: Field): string => `${idPrefix}-${field}`

  const focusFirstError = (nextErrors: FormErrors<Field>) => {
    const first = fields.find(field => nextErrors[field])
    if (first) {
      document.getElementById(fieldId(first))?.focus()
    }
  }

  const setValue = (field: Field, value: string) => {
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
  const validateAll = (): boolean => {
    const nextErrors = validate(values)
    setErrors(nextErrors)
    focusFirstError(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const showErrors = (nextErrors: FormErrors<Field>) => {
    setErrors(nextErrors)
    focusFirstError(nextErrors)
  }

  const fieldProps = (field: Field) => ({
    id: fieldId(field),
    name: field,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValue(field, event.target.value),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${fieldId(field)}-error` : undefined
  })

  return { values, errors, validate: validateAll, showErrors, fieldProps }
}
