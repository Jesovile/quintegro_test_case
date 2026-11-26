import React, { useImperativeHandle, useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { Field, Group, OptionRow, rowSeparator, Section } from './GroupedList'
import AddressSelect from './AddressSelect'
import {
  CARD_BRANDS,
  CARD_FIELD_ORDER,
  CardBrand,
  CardField,
  CardForm,
  cvcLengthFor,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  normalizeCardNumber,
  validateCard,
} from '@/lib/card'
import { Address, validateAddress } from '@/lib/validation'
import { focusLater, moveFocusOnEnter, useTouchedFields } from '@/lib/useTouchedFields'
import { cn } from '@/lib/utils'

export type PaymentMethod = 'apple-pay' | 'card' | 'paypal'

export interface BillingState {
  sameAsShipping: boolean
  address: Address | null
  address2: string
}

export const DEFAULT_BILLING: BillingState = { sameAsShipping: true, address: null, address2: '' }

export interface PaymentHandle {
  /** For card payments: shows all errors and focuses the first invalid field. */
  validateAndFocus: () => boolean
}

/**
 * Apple Pay on the web is only available in Safari on Apple devices
 * (window.ApplePaySession). Elsewhere the option is shown disabled.
 */
export function isApplePayAvailable(): boolean {
  const session = (window as unknown as { ApplePaySession?: { canMakePayments: () => boolean } }).ApplePaySession
  try {
    return Boolean(session?.canMakePayments())
  } catch {
    return false
  }
}

export const AppleLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className={className}>
    <path
      fill="currentColor"
      d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
    />
  </svg>
)

const BRAND_BADGE: Record<CardBrand, { text: string; className: string }> = {
  visa: { text: 'VISA', className: 'text-[#1a1f71] italic' },
  mastercard: { text: 'MC', className: 'text-[#eb001b]' },
  amex: { text: 'AMEX', className: 'text-[#006fcf]' },
  discover: { text: 'DISC', className: 'text-[#ff6000]' },
}

const FOOTERS: Record<PaymentMethod, string> = {
  'apple-pay': 'Pay securely with Face ID or Touch ID.',
  card: 'Your card details are encrypted and never stored.',
  paypal: "You'll be redirected to PayPal to complete your purchase.",
}

type PaymentField = CardField | 'billingAddress'
const PAYMENT_FIELD_ORDER: PaymentField[] = [...CARD_FIELD_ORDER, 'billingAddress']
const fieldId = (field: PaymentField) => `checkout-card-${field}`

interface Props {
  method: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  applePayAvailable: boolean
  card: CardForm
  onCardChange: (card: CardForm) => void
  billing: BillingState
  onBillingChange: (billing: BillingState) => void
}

const PaymentSection = React.forwardRef<PaymentHandle, Props>(
  ({ method, onMethodChange, applePayAvailable, card, onCardChange, billing, onBillingChange }, ref) => {
    const errors = useMemo(() => {
      const e: Partial<Record<PaymentField, string>> = validateCard(card)
      if (!billing.sameAsShipping) {
        const addressError = validateAddress(billing.address)
        if (addressError) e.billingAddress = addressError
      }
      return e
    }, [card, billing])

    const { visibleError, touch, untouchIfQuiet, touchAll } = useTouchedFields<PaymentField>(errors)

    useImperativeHandle(ref, () => ({
      validateAndFocus: () => {
        if (method !== 'card') return true
        touchAll(PAYMENT_FIELD_ORDER)
        const firstInvalid = PAYMENT_FIELD_ORDER.find((f) => errors[f])
        if (firstInvalid) {
          focusLater(fieldId(firstInvalid))
          return false
        }
        return true
      },
    }))

    const setCard = (field: CardField, value: string) => {
      untouchIfQuiet(field)
      onCardChange({ ...card, [field]: value })
    }

    const brand = detectCardBrand(card.number)
    const cvcLength = cvcLengthFor(card.number)
    const common = (field: CardField) => ({
      id: fieldId(field),
      error: visibleError(field),
      // Empty fields are only flagged by Place Order, not by tabbing through.
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value.trim()) touch(field)
      },
    })

    return (
      // A real <form> with standard autocomplete tokens lets browsers offer saved cards.
      <form noValidate autoComplete="on" onSubmit={(e) => e.preventDefault()} onKeyDown={moveFocusOnEnter}>
        <Section id="checkout-payment" title="Payment" footer={FOOTERS[method]}>
          <Group>
            <OptionRow
              name="payment"
              value="apple-pay"
              checked={method === 'apple-pay'}
              disabled={!applePayAvailable}
              onSelect={(v) => onMethodChange(v as PaymentMethod)}
              icon={<AppleLogo className="mb-0.5 h-4 w-4" />}
              iconClassName="bg-black"
              title="Apple Pay"
              subtitle={applePayAvailable ? undefined : 'Available in Safari on iPhone, iPad and Mac'}
            />
            <OptionRow
              name="payment"
              value="card"
              checked={method === 'card'}
              onSelect={(v) => onMethodChange(v as PaymentMethod)}
              icon={<CreditCard className="h-4 w-4" />}
              iconClassName="bg-[#007aff]"
              title="Credit or Debit Card"
              subtitle="Visa, Mastercard, American Express, Discover"
            />

            {method === 'card' && (
              <div className={`${rowSeparator} bg-gray-50/60`}>
                <Field
                  {...common('number')}
                  name="cardnumber"
                  label="Card Number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 1234 1234 1234"
                  value={formatCardNumber(card.number)}
                  onChange={(e) => setCard('number', normalizeCardNumber(e.target.value))}
                  suffix={
                    brand ? (
                      <span
                        aria-label={CARD_BRANDS[brand].label}
                        className={cn(
                          'rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide',
                          BRAND_BADGE[brand].className,
                        )}
                      >
                        {BRAND_BADGE[brand].text}
                      </span>
                    ) : undefined
                  }
                />
                <div className={`${rowSeparator} grid grid-cols-2`}>
                  <Field
                    {...common('expiry')}
                    name="cc-exp"
                    label="Expiration"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    maxLength={7}
                    value={card.expiry}
                    onChange={(e) => setCard('expiry', formatExpiry(e.target.value))}
                  />
                  <Field
                    {...common('cvc')}
                    name="cvc"
                    label="Security Code"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder={cvcLength === 4 ? '1234' : '123'}
                    maxLength={cvcLength}
                    className="border-l border-black/10"
                    value={card.cvc}
                    onChange={(e) => setCard('cvc', e.target.value.replace(/\D/g, '').slice(0, cvcLength))}
                  />
                </div>
                <Field
                  {...common('name')}
                  name="ccname"
                  label="Name on Card"
                  autoComplete="cc-name"
                  autoCapitalize="words"
                  spellCheck={false}
                  value={card.name}
                  onChange={(e) => setCard('name', e.target.value)}
                />

                <label className={`${rowSeparator} flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2.5`}>
                  <input
                    type="checkbox"
                    checked={billing.sameAsShipping}
                    onChange={(e) => onBillingChange({ ...billing, sameAsShipping: e.target.checked })}
                    className="h-[18px] w-[18px] accent-[#007aff]"
                  />
                  <span className="text-[15px] text-gray-900">Billing address same as shipping</span>
                </label>

                {!billing.sameAsShipping && (
                  <>
                    <AddressSelect
                      id={fieldId('billingAddress')}
                      label="Billing Address"
                      value={billing.address}
                      onChange={(address) => {
                        untouchIfQuiet('billingAddress')
                        onBillingChange({ ...billing, address })
                      }}
                      onBlur={() => {
                        if (billing.address) touch('billingAddress')
                      }}
                      error={visibleError('billingAddress')}
                    />
                    <Field
                      id="checkout-card-billingAddress2"
                      label="Apt, Suite, Unit (optional)"
                      autoComplete="billing address-line2"
                      maxLength={50}
                      value={billing.address2}
                      onChange={(e) => onBillingChange({ ...billing, address2: e.target.value })}
                    />
                  </>
                )}
              </div>
            )}

            <OptionRow
              name="payment"
              value="paypal"
              checked={method === 'paypal'}
              onSelect={(v) => onMethodChange(v as PaymentMethod)}
              icon={<span className="text-[13px] font-extrabold italic text-[#003087]">P</span>}
              iconClassName="bg-[#ffc439]"
              title="PayPal"
            />
          </Group>
        </Section>
      </form>
    )
  },
)
PaymentSection.displayName = 'PaymentSection'

export default PaymentSection
