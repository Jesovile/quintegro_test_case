import React, { useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useApolloClient, useQuery } from '@apollo/client'
import { CheckCircle2, CreditCard, Loader2, MapPin, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, InputProps } from '@/components/ui/input'
import { GET_ORDER, GET_ORDER_SUM } from '../graphql/queries'
import { SUBMIT_ORDER } from '../graphql/mutations'
import {
  buildCheckoutInput, CardForm, CheckoutErrors, CustomerForm, emptyCard, emptyCustomer,
  formatCardNumber, paymentErrorMessage, validateCheckoutForm
} from '../lib/checkout'

interface CheckoutOrder {
  orderId: string
  status: 'created' | 'submited' | 'finished'
  products: {
    product: { id: string; title: string; image: string }
    amount: number
    price: number
  }[]
  promo?: { id: string; discount: number; dueDate: number } | null
}

interface SubmissionResult {
  success: boolean
  code: string
}

interface FieldProps extends InputProps {
  id: string
  label: string
  error?: string
}

function Field({ id, label, error, ...props }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <Input {...props} id={id} required aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`h-11 bg-white text-base ${error ? 'border-red-500' : 'border-gray-300'}`} />
      {error && <p id={`${id}-error`} className="text-sm text-red-700">{error}</p>}
    </div>
  )
}

const money = (amount: number, currency = 'USD') => new Intl.NumberFormat('en-US', {
  style: 'currency', currency
}).format(amount)

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation()
  const client = useApolloClient()
  const authenticated = Boolean(localStorage.getItem('auth_token'))
  const [customer, setCustomer] = useState<CustomerForm>({ ...emptyCustomer })
  const [card, setCard] = useState<CardForm>({ ...emptyCard })
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [message, setMessage] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)
  const [paying, setPaying] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submitting = useRef(false)
  const errorPanel = useRef<HTMLDivElement>(null)
  const { data, loading, error, refetch } = useQuery<{ order: CheckoutOrder | null }>(GET_ORDER, {
    variables: { orderId }, fetchPolicy: 'network-only', skip: !authenticated
  })
  const order = data?.order
  const { data: totalData, loading: totalLoading, error: totalError, refetch: refetchTotal } = useQuery<{ orderSum: number }>(GET_ORDER_SUM, {
    variables: {
      orderId,
      products: order?.products.map(item => ({ id: item.product.id, amount: item.amount, price: item.price })) || [],
      promo: order?.promo?.id
    },
    fetchPolicy: 'network-only',
    skip: !authenticated || !order || order.status !== 'created'
  })
  const total = totalData?.orderSum
  const totalReady = typeof total === 'number' && Number.isFinite(total) && total > 0 && !totalLoading && !totalError
  const loginLink = { pathname: '/login', state: { from: location.pathname } }

  function changeCustomer(field: keyof CustomerForm, value: string) {
    setCustomer(previous => ({ ...previous, [field]: value }))
    setErrors(previous => ({ ...previous, [field]: undefined }))
  }

  function changeCard(field: keyof CardForm, value: string) {
    setCard(previous => ({ ...previous, [field]: value }))
    setErrors(previous => ({ ...previous, [field]: undefined }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || !totalReady || order?.status !== 'created') return
    setMessage('')
    setNeedsLogin(false)
    const validation = validateCheckoutForm(customer, card)
    setErrors(validation)
    const firstError = Object.keys(validation)[0]
    if (firstError) {
      event.currentTarget.querySelector<HTMLInputElement>(`#${firstError}`)?.focus()
      return
    }
    submitting.current = true
    setPaying(true)
    try {
      // Using the client directly avoids retaining request variables in mutation hook state.
      const result = await client.mutate<{ submitOrder: SubmissionResult }>({
        mutation: SUBMIT_ORDER,
        variables: { orderId, input: buildCheckoutInput(customer, card) },
        fetchPolicy: 'no-cache'
      })
      const submission = result.data?.submitOrder
      if (submission?.success) {
        setSubmitted(true)
        setCard({ ...emptyCard })
        setCustomer({ ...emptyCustomer })
        client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'orders' })
        void refetch().catch(() => { /* Payment is already confirmed even if refreshing fails. */ })
      } else {
        setMessage(paymentErrorMessage(submission?.code || 'INTERNAL_ERROR'))
        setNeedsLogin(submission?.code === 'AUTHENTICATION_REQUIRED')
        setCard(previous => ({ ...previous, securityCode: '' }))
        requestAnimationFrame(() => errorPanel.current?.focus())
      }
    } catch {
      // Never keep or log an Apollo/network error that could contain payment variables.
      setMessage(paymentErrorMessage('NETWORK_ERROR'))
      setCard(previous => ({ ...previous, securityCode: '' }))
      requestAnimationFrame(() => errorPanel.current?.focus())
    } finally {
      submitting.current = false
      setPaying(false)
    }
  }

  const backToOrders = <Button asChild variant="outline"><Link to="/order">Back to orders</Link></Button>

  if (!authenticated) {
    return <div className="mx-auto max-w-lg rounded-lg border border-gray-200 bg-white p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Sign in to checkout</h1>
      <p className="my-4 text-gray-600">Please sign in to view your order and complete payment.</p>
      <Button asChild><Link to={loginLink}>Sign in</Link></Button>
    </div>
  }

  if (submitted || (order && order.status !== 'created')) {
    return <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm" role="status">
      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-gray-900">{submitted ? 'Payment successful' : 'Order already submitted'}</h1>
      <p className="mt-3 text-gray-600">{submitted ? 'Thank you! Your order has been submitted.' : 'This order no longer needs checkout.'}</p>
      <p className="mt-2 text-gray-600">Order #{orderId}</p>
      <div className="mt-6">{backToOrders}</div>
    </div>
  }

  if (loading) return <div className="flex items-center justify-center gap-3 py-16" role="status">
    <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" /> Loading your order…
  </div>

  if (error || !order) {
    const authenticationError = error?.graphQLErrors.some(item => item.message === 'Authentication required')
    return <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Unable to load checkout</h1>
      <p role="alert" className="text-gray-600">{authenticationError
        ? 'Your session has expired. Sign in again to continue.'
        : 'We could not load this order. It may be unavailable, or there may be a connection problem.'}</p>
      <div className="flex flex-wrap gap-3">
        {authenticationError ? <Button asChild><Link to={loginLink}>Sign in</Link></Button>
          : <Button onClick={() => { void refetch().catch(() => {}) }}>Try again</Button>}
        {backToOrders}
      </div>
    </div>
  }

  return (
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-gray-600"><Link className="hover:text-blue-600 underline" to="/order">Your orders</Link><span className="mx-3">/</span>Checkout</nav>
      <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      <p className="mt-2 mb-8 text-gray-600">Enter your details and review your order before paying.</p>
      <form onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy={paying}>
        <fieldset disabled={paying} className="min-w-0 space-y-6">
          <legend className="sr-only">Checkout details</legend>
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-3 text-xl text-gray-900"><User className="h-5 w-5 text-blue-600" aria-hidden="true" />Customer information</CardTitle></CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field id="firstName" label="First name" autoComplete="given-name" maxLength={100} value={customer.firstName} onChange={e => changeCustomer('firstName', e.target.value)} error={errors.firstName} />
              <Field id="lastName" label="Last name" autoComplete="family-name" maxLength={100} value={customer.lastName} onChange={e => changeCustomer('lastName', e.target.value)} error={errors.lastName} />
              <Field id="email" label="Email" type="email" autoComplete="email" maxLength={254} value={customer.email} onChange={e => changeCustomer('email', e.target.value)} error={errors.email} />
              <Field id="phone" label="Phone" type="tel" autoComplete="tel" maxLength={40} value={customer.phone} onChange={e => changeCustomer('phone', e.target.value)} error={errors.phone} />
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-3 text-xl text-gray-900"><MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />Address</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <Field id="address" label="Address" autoComplete="street-address" placeholder="Street, apartment, and city" maxLength={1000} value={customer.address} onChange={e => changeCustomer('address', e.target.value)} error={errors.address} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="state" label="State" autoComplete="address-level1" maxLength={100} value={customer.state} onChange={e => changeCustomer('state', e.target.value)} error={errors.state} />
                <Field id="zipcode" label="ZIP code" autoComplete="postal-code" inputMode="text" placeholder="12345 or 12345-6789" maxLength={10} value={customer.zipcode} onChange={e => changeCustomer('zipcode', e.target.value)} error={errors.zipcode} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-3 text-xl text-gray-900"><CreditCard className="h-5 w-5 text-blue-600" aria-hidden="true" />Card details</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <Field id="cardholderName" label="Name on card" autoComplete="cc-name" maxLength={100} value={card.cardholderName} onChange={e => changeCard('cardholderName', e.target.value)} error={errors.cardholderName} />
              <Field id="number" label="Card number" autoComplete="cc-number" inputMode="numeric" placeholder="1234 5678 9012 3456" maxLength={23} value={card.number} onChange={e => changeCard('number', formatCardNumber(e.target.value))} error={errors.number} />
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="expiryMonth" label="Expiry month" autoComplete="cc-exp-month" inputMode="numeric" placeholder="MM" maxLength={2} value={card.expiryMonth} onChange={e => changeCard('expiryMonth', e.target.value)} error={errors.expiryMonth} />
                <Field id="expiryYear" label="Expiry year" autoComplete="cc-exp-year" inputMode="numeric" placeholder="YYYY" maxLength={4} value={card.expiryYear} onChange={e => changeCard('expiryYear', e.target.value)} error={errors.expiryYear} />
                <Field id="securityCode" label="Security code" type="password" autoComplete="cc-csc" inputMode="numeric" placeholder="CVV" maxLength={4} value={card.securityCode} onChange={e => changeCard('securityCode', e.target.value)} error={errors.securityCode} />
              </div>
            </CardContent>
          </Card>
        </fieldset>
        <aside className="min-w-0 lg:sticky lg:top-0" aria-label="Order summary">
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="text-xl text-gray-900">Order summary</CardTitle><p className="text-sm text-gray-600">Order #{order.orderId}</p></CardHeader>
            <CardContent>
              <ul className="divide-y divide-gray-200">
                {order.products.map(item => <li key={item.product.id} className="flex justify-between gap-4 py-4 first:pt-0">
                  <div><p className="font-medium text-gray-900">{item.product.title}</p><p className="mt-1 text-sm text-gray-600">Qty {item.amount} × {money(item.price)}</p></div>
                  <p className="shrink-0 font-medium text-gray-900">{money(item.price * item.amount)}</p>
                </li>)}
              </ul>
              <div className="mt-4 border-t border-gray-200 pt-5">
                {totalLoading && <p role="status" className="text-gray-600">Calculating total…</p>}
                {totalError && <div role="alert" className="space-y-3 text-sm text-red-700"><p>We could not calculate your total.</p><Button type="button" variant="outline" disabled={paying} onClick={() => { void refetchTotal().catch(() => {}) }}>Retry total</Button></div>}
                {totalReady && <div className="flex items-center justify-between gap-3 text-xl font-semibold text-gray-900"><span>Order total</span><span>{money(total)}</span></div>}
                {!totalLoading && !totalError && !totalReady && <p role="alert" className="text-sm text-red-700">This order does not have a valid total.</p>}
              </div>
              {message && <div ref={errorPanel} role="alert" tabIndex={-1} className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{message}</p>{needsLogin && <Link to={loginLink} className="mt-2 inline-block font-medium underline">Sign in</Link>}</div>}
              <Button type="submit" disabled={paying || !totalReady} className="mt-6 h-12 w-full bg-blue-600 text-base text-white hover:bg-blue-700">
                {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Processing payment…</> : `Pay${totalReady ? ` ${money(total!)}` : ''}`}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  )
}

export default CheckoutPage
