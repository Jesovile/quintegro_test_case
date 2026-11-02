import React from 'react'
import { CHECKOUT_STEP_HEADING_ID } from '@/lib/checkoutSteps'
import { useMutation } from '@apollo/client'
import { SAVE_DELIVERY } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, selectClassName } from '@/components/ui/form-field'
import { useDeliveryForm } from '@/hooks/useDeliveryForm'
import { toDeliveryFormErrors, toDeliveryFormValues } from '@/lib/deliveryValidation'
import { getErrorMessage, getFieldErrors, isRetryable } from '@/lib/graphqlErrors'
import { ErrorState } from '@/components/ui/state-views'
import { US_STATES } from '@/lib/usStates'
import { Delivery, Order } from '@/types/order'

interface DeliveryStepProps {
  order: Order
  delivery: Delivery | null
  defaultFullName: string
  notice?: string
  onSaved: () => void
  // Called when the user sends the form, before the server answers
  onSubmit?: () => void
}

const DeliveryStep: React.FC<DeliveryStepProps> = ({ order, delivery, defaultFullName, notice, onSaved, onSubmit }) => {
  const form = useDeliveryForm(toDeliveryFormValues(delivery, defaultFullName))
  const { errors, fieldProps } = form

  const [saveDelivery, { loading, error }] = useMutation(SAVE_DELIVERY, {
    onCompleted: onSaved,
    onError: (saveError) => {
      const fieldErrors = toDeliveryFormErrors(getFieldErrors(saveError))
      if (Object.keys(fieldErrors).length > 0) {
        form.showErrors(fieldErrors)
      }
    }
  })

  const save = () => {
    onSubmit?.()
    return saveDelivery({ variables: { orderId: order.orderId, input: form.toInput() } })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (form.validate()) {
      save()
    }
  }

  // Errors that do not belong to a field, e.g. the address service is down
  const formError = error && Object.keys(getFieldErrors(error)).length === 0 ? error : null

  return (
    <form noValidate onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 id={CHECKOUT_STEP_HEADING_ID} tabIndex={-1} className="focus:outline-none text-xl font-semibold text-gray-900 mb-1">
        Delivery
      </h2>
      <p className="mb-6 text-sm text-gray-600">We deliver within the United States.</p>
      {notice && (
        <p role="status" className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {notice}
        </p>
      )}

      <fieldset className="mb-6 space-y-4">
        <legend className="mb-2 text-base font-semibold text-gray-900">Contact</legend>
        <FormField id={fieldProps('fullName').id} label="Full name" required error={errors.fullName}>
          <Input {...fieldProps('fullName')} autoComplete="name" aria-required="true" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={fieldProps('email').id} label="Email" required error={errors.email}>
            <Input {...fieldProps('email')} type="email" inputMode="email" autoComplete="email" aria-required="true" />
          </FormField>
          <FormField id={fieldProps('phone').id} label="Phone" required error={errors.phone}>
            <Input {...fieldProps('phone')} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(555) 123-4567" aria-required="true" />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="mb-6 space-y-4">
        <legend className="mb-2 text-base font-semibold text-gray-900">Address</legend>
        <FormField id={fieldProps('line1').id} label="Street address" required error={errors.line1}>
          <Input {...fieldProps('line1')} autoComplete="address-line1" aria-required="true" />
        </FormField>
        <FormField id={fieldProps('line2').id} label="Apartment, suite" error={errors.line2}>
          <Input {...fieldProps('line2')} autoComplete="address-line2" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id={fieldProps('city').id} label="City" required error={errors.city}>
            <Input {...fieldProps('city')} autoComplete="address-level2" aria-required="true" />
          </FormField>
          <FormField id={fieldProps('state').id} label="State" required error={errors.state}>
            <select {...fieldProps('state')} autoComplete="address-level1" aria-required="true" className={selectClassName}>
              <option value="">Select a state</option>
              {US_STATES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={fieldProps('zip').id} label="ZIP code" required error={errors.zip}>
            <Input {...fieldProps('zip')} inputMode="numeric" autoComplete="postal-code" aria-required="true" />
          </FormField>
        </div>
      </fieldset>

      {formError &&
        (isRetryable(formError) && !loading ? (
          <ErrorState message={getErrorMessage(formError)} onRetry={save} />
        ) : (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {getErrorMessage(formError)}
          </p>
        ))}

      <div className="flex justify-end">
        <Button type="submit" loading={loading} className="min-w-[11rem] bg-blue-600 hover:bg-blue-700 text-white">
          Continue to payment
        </Button>
      </div>
    </form>
  )
}

export default DeliveryStep
