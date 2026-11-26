import React, { useMemo, useRef, useState } from 'react'
import { Link, useHistory, useLocation, useParams } from 'react-router-dom'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react'
import { GET_DELIVERY_OPTIONS, GET_ORDER, GET_ORDER_SUM } from '@/graphql/queries'
import { SUBMIT_ORDER } from '@/graphql/mutations'
import ContactShippingSection, { ContactShippingHandle } from '@/components/checkout/ContactShippingSection'
import DeliverySection from '@/components/checkout/DeliverySection'
import PaymentSection, {
  AppleLogo,
  BillingState,
  DEFAULT_BILLING,
  PaymentHandle,
  PaymentMethod,
  isApplePayAvailable,
} from '@/components/checkout/PaymentSection'
import OrderSummary, { AppliedPromo, SummaryItem, promoErrorText } from '@/components/checkout/OrderSummary'
import { LoadError } from '@/components/checkout/States'
import { ContactShipping, EMPTY_CONTACT_SHIPPING, formatUsPhone, validateContactShipping } from '@/lib/validation'
import { CardForm, EMPTY_CARD } from '@/lib/card'
import {
  DELIVERY_PARTNER_NAME,
  DeliveryDay,
  DeliveryOption,
  DeliverySelection,
  formatDay,
  formatTimeRange,
  formatWindow,
  isDeliveryComplete,
} from '@/lib/delivery'
import { focusLater } from '@/lib/useTouchedFields'
import { fromCents, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'

interface OrderData {
  orderId: string
  status: 'created' | 'submited' | 'finished'
  products: SummaryItem[]
}

// Contact & shipping details are remembered on this device for the next checkout.
// Card data is never persisted.
const CONTACT_STORAGE_KEY = 'checkout_contact_shipping'

function loadContact(): ContactShipping {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY)
    return raw ? { ...EMPTY_CONTACT_SHIPPING, ...JSON.parse(raw) } : EMPTY_CONTACT_SHIPPING
  } catch {
    return EMPTY_CONTACT_SHIPPING
  }
}

const DELIVERY_LABELS: Record<DeliverySelection['type'], string> = {
  express: 'Express delivery',
  standard: 'Standard delivery',
  scheduled: 'Scheduled delivery',
}

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation<{ products?: SummaryItem[] } | undefined>()
  const history = useHistory()
  const client = useApolloClient()
  const signedIn = Boolean(localStorage.getItem('auth_token'))

  /* ----------------------------- server data ----------------------------- */

  const orderQuery = useQuery<{ order: OrderData | null }>(GET_ORDER, {
    variables: { orderId },
    skip: !signedIn,
    notifyOnNetworkStatusChange: true,
  })
  const deliveryQuery = useQuery<{ deliveryOptions: DeliveryOption[]; deliveryDays: DeliveryDay[] }>(
    GET_DELIVERY_OPTIONS,
    { skip: !signedIn, notifyOnNetworkStatusChange: true },
  )

  const order = orderQuery.data?.order ?? null
  // Quantities edited on the orders page are only kept locally, so prefer them.
  const items: SummaryItem[] = location.state?.products ?? order?.products ?? []
  const subtotal = fromCents(items.reduce((sum, i) => sum + toCents(i.price) * i.amount, 0))

  /* ------------------------------ form state ------------------------------ */

  const [contact, setContact] = useState<ContactShipping>(loadContact)
  const [contactConfirmed, setContactConfirmed] = useState(
    () => Object.keys(validateContactShipping(loadContact())).length === 0,
  )
  const [delivery, setDelivery] = useState<DeliverySelection>({ type: 'express' })
  const [deliveryError, setDeliveryError] = useState<string>()
  const applePayAvailable = useMemo(isApplePayAvailable, [])
  const [method, setMethod] = useState<PaymentMethod>(applePayAvailable ? 'apple-pay' : 'card')
  const [card, setCard] = useState<CardForm>(EMPTY_CARD)
  const [billing, setBilling] = useState<BillingState>(DEFAULT_BILLING)
  const [promo, setPromo] = useState<AppliedPromo | null>(null)
  const [submitError, setSubmitError] = useState<string>()
  const [placed, setPlaced] = useState(false)

  const contactRef = useRef<ContactShippingHandle>(null)
  const paymentRef = useRef<PaymentHandle>(null)

  const sumQuery = useQuery<{ orderSum: number }>(GET_ORDER_SUM, {
    variables: {
      orderId,
      products: items.map((i) => ({ id: i.product.id, amount: i.amount, price: i.price })),
      promo: promo?.code,
    },
    skip: !signedIn || items.length === 0,
    notifyOnNetworkStatusChange: true,
  })

  const [submitOrder, { loading: submitting }] = useMutation(SUBMIT_ORDER)

  const deliveryOption = deliveryQuery.data?.deliveryOptions.find((o) => o.type === delivery.type)

  const saveContact = (next: ContactShipping) => {
    setContact(next)
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(next))
  }

  /* ------------------------------ place order ----------------------------- */

  const handlePlaceOrder = async () => {
    setSubmitError(undefined)

    if (!contactRef.current?.validateAndFocus()) {
      setContactConfirmed(false)
      return
    }
    setContactConfirmed(true)
    saveContact(contact)

    if (!isDeliveryComplete(delivery)) {
      setDeliveryError(delivery.date ? 'Choose a delivery time' : 'Choose a delivery day and time')
      focusLater('checkout-delivery')
      return
    }

    if (!paymentRef.current?.validateAndFocus()) return

    try {
      await submitOrder({ variables: { orderId, promo: promo?.code } })
      // Order status changed on the server: drop cached orders so lists refetch.
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'orders' })
      client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'order' })
      client.cache.gc()
      setPlaced(true)
      window.scrollTo({ top: 0 })
    } catch (error) {
      const message = (error as { graphQLErrors?: { message: string }[] }).graphQLErrors?.[0]?.message
      const promoMessage = message && promoErrorText(message)
      if (promoMessage) {
        setPromo(null)
        setSubmitError(`${promoMessage}. We removed it, please review your total.`)
      } else {
        setSubmitError("We couldn't place your order. Please try again.")
      }
    }
  }

  /* -------------------------------- render -------------------------------- */

  if (!signedIn) {
    return (
      <Notice title="Sign in to check out">
        <Link to="/login" className="font-medium text-[#007aff] hover:underline">
          Go to sign in
        </Link>
      </Notice>
    )
  }

  if (orderQuery.loading && !order) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading checkout" />
      </div>
    )
  }

  if (!order) {
    return (
      <Notice title="We couldn't load this order">
        <LoadError message="Something went wrong." onRetry={() => orderQuery.refetch()} className="justify-center" />
      </Notice>
    )
  }

  if (placed) {
    const a = contact.address!
    const when =
      delivery.type === 'scheduled' && delivery.date && delivery.slot
        ? `${formatDay(delivery.date)}, ${formatTimeRange(delivery.slot.startTime, delivery.slot.endTime)}`
        : deliveryOption?.window
          ? formatWindow(deliveryOption.window)
          : ''
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#34c759]" />
        <h1 className="mt-4 text-[28px] font-bold tracking-tight text-gray-900">Thank you, {contact.fullName.trim()}!</h1>
        <p className="mt-2 text-[15px] text-gray-500">
          Order #{order.orderId} is confirmed. We sent the receipt to {contact.email.trim()}.
        </p>
        <div className="mt-6 rounded-2xl bg-white p-5 text-left text-[14px] shadow-sm ring-1 ring-black/[.06]">
          <p className="text-gray-500">Delivery by {DELIVERY_PARTNER_NAME}</p>
          <p className="font-medium text-gray-900">
            {deliveryOption?.title}
            {when && ` · ${when}`}
          </p>
          <p className="mt-3 text-gray-500">Ship to</p>
          <p className="text-gray-900">
            {a.line1}
            {contact.address2.trim() && `, ${contact.address2.trim()}`}, {a.city}, {a.state} {a.zip}
          </p>
          <p className="mt-3 text-gray-500">Tracking updates</p>
          <p className="text-gray-900">+1 {formatUsPhone(contact.phone)}</p>
        </div>
        <button
          type="button"
          onClick={() => history.push('/order')}
          className="mt-6 h-11 rounded-xl bg-[#007aff] px-6 text-[15px] font-semibold text-white hover:brightness-110"
        >
          Back to Orders
        </button>
      </div>
    )
  }

  if (order.status !== 'created') {
    return (
      <Notice title="This order has already been placed">
        <Link to="/order" className="font-medium text-[#007aff] hover:underline">
          Back to orders
        </Link>
      </Notice>
    )
  }

  const total =
    sumQuery.data?.orderSum !== undefined && deliveryOption
      ? fromCents(toCents(sumQuery.data.orderSum) + toCents(deliveryOption.price))
      : undefined
  const ctaDisabled = submitting || total === undefined

  const cta = (
    <button
      type="button"
      onClick={handlePlaceOrder}
      disabled={ctaDisabled}
      className={cn(
        'mt-4 flex h-[50px] w-full items-center justify-center gap-1.5 rounded-xl text-[17px] font-semibold tracking-tight transition',
        'focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
        method === 'apple-pay' && 'bg-black text-white focus-visible:ring-black/30',
        method === 'card' && 'bg-[#007aff] text-white hover:brightness-110 focus-visible:ring-[#007aff]/30',
        method === 'paypal' && 'bg-[#ffc439] italic text-[#003087] hover:brightness-105 focus-visible:ring-[#ffc439]/50',
      )}
    >
      {submitting ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Placing order" />
      ) : method === 'apple-pay' ? (
        <>
          <AppleLogo className="mb-0.5 h-[18px] w-[18px]" /> Pay
        </>
      ) : method === 'paypal' ? (
        <span className="font-extrabold">
          Pay<span className="text-[#0070e0]">Pal</span>
        </span>
      ) : (
        'Place Order'
      )}
    </button>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/order" className="mb-2 inline-flex items-center text-[15px] text-[#007aff] hover:underline">
        <ChevronLeft className="h-4 w-4" /> Orders
      </Link>
      <h1 className="mb-6 text-[30px] font-bold tracking-tight text-gray-900">Checkout</h1>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <ContactShippingSection
            ref={contactRef}
            value={contact}
            onChange={setContact}
            confirmed={contactConfirmed}
            onConfirm={() => {
              setContactConfirmed(true)
              saveContact(contact)
            }}
            onEdit={() => setContactConfirmed(false)}
          />
          <DeliverySection
            options={deliveryQuery.data?.deliveryOptions}
            days={deliveryQuery.data?.deliveryDays}
            loading={deliveryQuery.loading}
            failed={Boolean(deliveryQuery.error)}
            onRetry={() => deliveryQuery.refetch()}
            value={delivery}
            onChange={(next) => {
              setDelivery(next)
              setDeliveryError(undefined)
            }}
            error={deliveryError}
          />
          <PaymentSection
            ref={paymentRef}
            method={method}
            onMethodChange={setMethod}
            applePayAvailable={applePayAvailable}
            card={card}
            onCardChange={setCard}
            billing={billing}
            onBillingChange={setBilling}
          />
        </div>

        <div className="lg:sticky lg:top-6">
          <OrderSummary
            items={items}
            subtotal={subtotal}
            orderSum={sumQuery.error ? undefined : sumQuery.data?.orderSum}
            sumLoading={sumQuery.loading}
            sumFailed={Boolean(sumQuery.error)}
            onRetrySum={() => sumQuery.refetch()}
            deliveryLabel={DELIVERY_LABELS[delivery.type]}
            deliveryPrice={deliveryOption?.price}
            promo={promo}
            onPromoChange={setPromo}
            cta={cta}
            submitError={submitError}
          />
        </div>
      </div>
    </div>
  )
}

const Notice: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mx-auto max-w-md py-16 text-center">
    <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">{title}</h1>
    <div className="mt-3 text-[15px]">{children}</div>
  </div>
)

export default CheckoutPage
