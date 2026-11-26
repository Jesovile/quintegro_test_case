import React, { useState } from 'react'
import { useLazyQuery } from '@apollo/client'
import { Loader2, Lock, Tag, X } from 'lucide-react'
import { GET_PROMO } from '@/graphql/queries'
import { formatPrice } from '@/lib/delivery'
import { assetUrl } from '@/lib/assetUrl'
import { formatMoney, fromCents, toCents } from '@/lib/money'
import { LoadError } from './States'

export interface SummaryItem {
  product: { id: string; title: string; image: string }
  amount: number
  price: number
}

export interface AppliedPromo {
  code: string
  discount: number // percent
}

const PROMO_ERRORS: Record<string, string> = {
  'Promo not found': "This code isn't valid",
  'Promo expired': 'This code has expired',
  'Promo already used': "You've already used this code",
}

export const promoErrorText = (message: string) => PROMO_ERRORS[message]

interface Props {
  items: SummaryItem[]
  subtotal: number
  /** Server-calculated sum after promo, without delivery. */
  orderSum: number | undefined
  sumLoading: boolean
  sumFailed: boolean
  onRetrySum: () => void
  deliveryLabel: string
  deliveryPrice: number | undefined
  promo: AppliedPromo | null
  onPromoChange: (promo: AppliedPromo | null) => void
  cta: React.ReactNode
  submitError?: string
}

const money = formatMoney

/** Falls back to the product initial when the image fails to load. */
const ProductThumb: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="grid h-12 w-12 place-items-center rounded-[10px] bg-gray-100 text-[15px] font-semibold text-gray-500">
        {title.charAt(0)}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-12 w-12 rounded-[10px] bg-gray-100 object-contain p-1.5"
    />
  )
}

const OrderSummary: React.FC<Props> = ({
  items,
  subtotal,
  orderSum,
  sumLoading,
  sumFailed,
  onRetrySum,
  deliveryLabel,
  deliveryPrice,
  promo,
  onPromoChange,
  cta,
  submitError,
}) => {
  const [code, setCode] = useState('')
  const [promoError, setPromoError] = useState<string>()
  const [checkPromo, { loading: checking }] = useLazyQuery(GET_PROMO, { fetchPolicy: 'network-only' })

  const applyPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    setPromoError(undefined)
    const result = await checkPromo({ variables: { promoId: normalized } })
    const found = result.data?.promo as { id: string; discount: number } | undefined
    if (found) {
      onPromoChange({ code: found.id, discount: found.discount })
      setCode('')
      return
    }
    // With errorPolicy "all" GraphQL errors may arrive in `error` or in `errors`.
    const message =
      result.error?.graphQLErrors?.[0]?.message ??
      (result as { errors?: ReadonlyArray<{ message: string }> }).errors?.[0]?.message
    setPromoError((message && promoErrorText(message)) || "Couldn't check the code. Please try again.")
  }

  // The backend returns the sum after the promo; the discount line is the difference, in cents.
  const discount = promo && orderSum !== undefined ? fromCents(Math.max(0, toCents(subtotal) - toCents(orderSum))) : 0
  const total =
    orderSum !== undefined && deliveryPrice !== undefined
      ? fromCents(toCents(orderSum) + toCents(deliveryPrice))
      : undefined

  return (
    <aside aria-label="Order summary" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[.06]">
      <h2 className="mb-4 text-[17px] font-semibold tracking-tight text-gray-900">Order Summary</h2>

      <ul className="mb-4 space-y-3 border-b border-black/10 pb-4">
        {items.map((item) => (
          <li key={item.product.id} className="flex items-center gap-3">
            <span className="relative shrink-0">
              <ProductThumb src={assetUrl(item.product.image)} title={item.product.title} />
              <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gray-500 px-1 text-[11px] font-semibold text-white">
                {item.amount}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-gray-900">{item.product.title}</span>
            <span className="text-[14px] text-gray-900">{money(fromCents(toCents(item.price) * item.amount))}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1.5 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-gray-500">Subtotal</dt>
          <dd className="text-gray-900">{money(subtotal)}</dd>
        </div>
        {promo && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Promo ({promo.discount}%)</dt>
            <dd className="text-[#34c759]">{orderSum === undefined ? '…' : `−${money(discount)}`}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-gray-500">{deliveryLabel}</dt>
          <dd className="text-gray-900">{deliveryPrice === undefined ? '…' : formatPrice(deliveryPrice)}</dd>
        </div>
      </dl>

      {promo ? (
        <div className="mt-3 flex items-center justify-between rounded-[10px] bg-[#34c759]/10 px-3 py-2 text-[13px]">
          <span className="flex items-center gap-1.5 font-medium text-[#248a3d]">
            <Tag className="h-3.5 w-3.5" /> {promo.code} applied
          </span>
          <button
            type="button"
            aria-label={`Remove promo code ${promo.code}`}
            onClick={() => onPromoChange(null)}
            className="text-gray-500 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={applyPromo} className="mt-3">
          <div className="flex gap-2">
            <label htmlFor="checkout-promo" className="sr-only">
              Promo code
            </label>
            <input
              id="checkout-promo"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setPromoError(undefined)
              }}
              placeholder="Promo code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={promoError ? true : undefined}
              aria-describedby={promoError ? 'checkout-promo-error' : undefined}
              className="min-w-0 flex-1 rounded-[10px] bg-[#767680]/[.12] px-3 py-2 text-[14px] uppercase outline-none placeholder:normal-case placeholder:text-gray-400 focus:ring-2 focus:ring-[#007aff]/40"
            />
            <button
              type="submit"
              disabled={!code.trim() || checking}
              className="flex items-center gap-1 px-1 text-[14px] font-semibold text-[#007aff] disabled:text-gray-300"
            >
              {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Apply
            </button>
          </div>
          {promoError && (
            <p id="checkout-promo-error" role="alert" className="mt-1.5 text-[12px] text-[#ff3b30]">
              {promoError}
            </p>
          )}
        </form>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-black/10 pt-3">
        <span className="text-[15px] text-gray-900">Total</span>
        <span className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-gray-900">
          {sumLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Calculating" />}
          {total === undefined ? '—' : money(total)}
        </span>
      </div>
      {sumFailed && !sumLoading && (
        <LoadError message="Couldn't calculate the total." onRetry={onRetrySum} className="-mx-4 px-4" />
      )}

      {cta}

      {submitError && (
        <p role="alert" className="mt-2 text-center text-[13px] text-[#ff3b30]">
          {submitError}
        </p>
      )}
      <p className="mt-3 text-center text-[11.5px] leading-snug text-gray-500">
        By placing your order, you agree to our <span className="text-[#007aff]">Terms</span> and{' '}
        <span className="text-[#007aff]">Privacy Policy</span>.
      </p>
      <p className="mt-2 flex items-center justify-center gap-1 text-[12px] text-gray-400">
        <Lock className="h-3 w-3" /> Secure checkout
      </p>
    </aside>
  )
}

export default OrderSummary
