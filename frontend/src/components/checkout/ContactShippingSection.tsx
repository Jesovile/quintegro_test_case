import React, { useImperativeHandle, useMemo } from 'react'
import { focusLater, moveFocusOnEnter, useTouchedFields } from '@/lib/useTouchedFields'
import { ChevronRight } from 'lucide-react'
import { Field, Group, rowSeparator, Section } from './GroupedList'
import AddressSelect from './AddressSelect'
import {
  ContactShipping,
  ContactShippingField,
  FIELD_ORDER,
  formatUsPhone,
  normalizeUsPhone,
  validateContactShipping,
} from '@/lib/validation'

export interface ContactShippingHandle {
  /** Shows every error and focuses the first invalid field. Returns true if the form is valid. */
  validateAndFocus: () => boolean
}

interface Props {
  value: ContactShipping
  onChange: (next: ContactShipping) => void
  /** Collapsed, read-only summary once the customer has confirmed the details. */
  confirmed: boolean
  onConfirm: () => void
  onEdit: () => void
}

const fieldId = (field: ContactShippingField) => `checkout-${field}`

const ContactShippingSection = React.forwardRef<ContactShippingHandle, Props>(
  ({ value, onChange, confirmed, onConfirm, onEdit }, ref) => {
    const errors = useMemo(() => validateContactShipping(value), [value])
    const { visibleError, touch, untouchIfQuiet, touchAll } = useTouchedFields<ContactShippingField>(errors)

    const set = <K extends keyof ContactShipping>(field: K, next: ContactShipping[K]) => {
      untouchIfQuiet(field)
      onChange({ ...value, [field]: next })
    }

    const validateAndFocus = () => {
      touchAll(FIELD_ORDER)
      const firstInvalid = FIELD_ORDER.find((f) => errors[f])
      if (firstInvalid) {
        // The form may be collapsed right now: focus after it renders.
        focusLater(fieldId(firstInvalid))
        return false
      }
      return true
    }

    useImperativeHandle(ref, () => ({ validateAndFocus }))

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (validateAndFocus()) onConfirm()
    }

    const common = (field: ContactShippingField) => ({
      id: fieldId(field),
      name: field,
      error: visibleError(field),
      // Empty fields are only flagged by Continue / Place Order, not by tabbing through.
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value.trim()) touch(field)
      },
    })

    if (confirmed && value.address) {
      const unit = value.address2.trim()
      return (
        <Section title="Contact & Shipping">
          <Group>
            <SummaryRow onClick={onEdit} label="Edit contact details">
              <span className="block truncate text-[15px] text-gray-900">{value.email.trim()}</span>
              <span className="block text-[13px] text-gray-500">+1 {formatUsPhone(value.phone)}</span>
            </SummaryRow>
            <SummaryRow onClick={onEdit} label="Edit shipping address">
              <span className="block text-[15px] text-gray-900">{value.fullName.trim()}</span>
              <span className="block truncate text-[13px] text-gray-500">
                {value.address.line1}
                {unit && `, ${unit}`}, {value.address.city}, {value.address.state} {value.address.zip}
              </span>
            </SummaryRow>
          </Group>
        </Section>
      )
    }

    return (
      <form noValidate onSubmit={handleSubmit} onKeyDown={moveFocusOnEnter}>
        <Section title="Contact" footer="We'll send your receipt and the delivery tracking link here.">
          <Group>
            <Field
              {...common('email')}
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@example.com"
              value={value.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <Field
              {...common('phone')}
              label="Phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(650) 555-0123"
              prefix={<span aria-label="United States, +1">🇺🇸 +1</span>}
              value={formatUsPhone(value.phone)}
              onChange={(e) => set('phone', normalizeUsPhone(e.target.value))}
            />
          </Group>
        </Section>

        <Section title="Shipping Address" footer="We currently deliver within the United States only.">
          <Group>
            <Field
              {...common('fullName')}
              label="Full Name"
              autoComplete="name"
              placeholder="Alex Smith"
              value={value.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
            <AddressSelect
              id={fieldId('address')}
              label="Address"
              value={value.address}
              onChange={(address) => set('address', address)}
              onBlur={() => {
                if (value.address) touch('address')
              }}
              error={visibleError('address')}
            />
            <Field
              {...common('address2')}
              label="Apt, Suite, Unit (optional)"
              autoComplete="address-line2"
              maxLength={50}
              value={value.address2}
              onChange={(e) => set('address2', e.target.value)}
            />
          </Group>
        </Section>

        <button
          type="submit"
          className="-mt-2 mb-8 h-11 w-full rounded-xl bg-[#007aff] text-[15px] font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007aff]/30"
        >
          Continue
        </button>
      </form>
    )
  },
)
ContactShippingSection.displayName = 'ContactShippingSection'

const SummaryRow: React.FC<{ onClick: () => void; label: string; children: React.ReactNode }> = ({
  onClick,
  label,
  children,
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`${rowSeparator} flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[.02] focus-visible:bg-[#007aff]/[.06] focus-visible:outline-none`}
  >
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
  </button>
)

export default ContactShippingSection
