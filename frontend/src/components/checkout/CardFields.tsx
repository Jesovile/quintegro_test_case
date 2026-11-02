import React from 'react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { CardField, CardFormErrors } from '@/lib/cardValidation'

interface CardFieldsProps {
  errors: CardFormErrors
  fieldProps: (field: CardField) => React.InputHTMLAttributes<HTMLInputElement> & { id: string }
  readOnly: boolean
}

const CardFields: React.FC<CardFieldsProps> = ({ errors, fieldProps, readOnly }) => (
  <fieldset className="mb-6 space-y-4">
    <legend className="mb-2 text-base font-semibold text-gray-900">Card</legend>
    <FormField id={fieldProps('cardNumber').id} label="Card number" required error={errors.cardNumber}>
      <Input
        {...fieldProps('cardNumber')}
        readOnly={readOnly}
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="1234 1234 1234 1234"
        aria-required="true"
      />
    </FormField>
    <div className="grid gap-4 grid-cols-2">
      <FormField id={fieldProps('expiry').id} label="Expiry" required error={errors.expiry}>
        <Input {...fieldProps('expiry')} readOnly={readOnly} autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} aria-required="true" />
      </FormField>
      <FormField id={fieldProps('cvc').id} label="Security code" required error={errors.cvc}>
        <Input {...fieldProps('cvc')} readOnly={readOnly} inputMode="numeric" autoComplete="cc-csc" maxLength={4} aria-required="true" />
      </FormField>
    </div>
  </fieldset>
)

export default CardFields
