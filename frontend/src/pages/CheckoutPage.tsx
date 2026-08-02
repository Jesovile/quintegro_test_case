import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import { useHistory, useParams } from 'react-router-dom'
import CheckoutConfirmation from '../components/checkout/CheckoutConfirmation'
import CheckoutSummary from '../components/checkout/CheckoutSummary'
import DeliveryForm from '../components/checkout/DeliveryForm'
import PaymentForm from '../components/checkout/PaymentForm'
import { Input } from '../components/ui/input'
import { SUBMIT_ORDER } from '../graphql/mutations'
import { GET_CHECKOUT_QUOTE, GET_ORDER, GET_ORDERS } from '../graphql/queries'
import { CheckoutQuote, DeliveryAddress, Order } from '../lib/checkoutTypes'
import { tokenizeMockPayment } from '../lib/mockPaymentTokenizer'

const emptyAddress: DeliveryAddress = { fullName: '', street: '', city: '', postalCode: '', country: '' }
const createAttemptId = () => window.crypto?.randomUUID?.() || `attempt_${Date.now()}`

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { data, loading: orderLoading, error: orderError, refetch } = useQuery<{ order: Order }>(GET_ORDER, { variables: { orderId } })
  const [address, setAddress] = useState(emptyAddress)
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard')
  const [promoCode, setPromoCode] = useState('')
  const [quote, setQuote] = useState<CheckoutQuote>()
  const [requestQuote] = useLazyQuery<{ checkoutQuote: CheckoutQuote }>(GET_CHECKOUT_QUOTE, { fetchPolicy: 'no-cache' })
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string>()
  const [submitOrder, { loading: submitting }] = useMutation(SUBMIT_ORDER, { refetchQueries: [{ query: GET_ORDERS }] })
  const [submissionError, setSubmissionError] = useState<string>()
  const [paymentFormKey, setPaymentFormKey] = useState(0)
  const [attemptId, setAttemptId] = useState(createAttemptId)
  const [completedCheckout, setCompletedCheckout] = useState<Order['checkout']>()
  const quoteRequestId = useRef(0)

  const order = data?.order
  const products = useMemo(() => order?.products.map(item => ({ productId: item.product.id, quantity: item.amount })) || [], [order])
  const addressComplete = Object.values(address).every(value => value.trim())

  useEffect(() => {
    const requestId = ++quoteRequestId.current
    setQuote(undefined)
    setQuoteError(undefined)
    if (!order || order.status !== 'created' || !addressComplete) {
      setQuoteLoading(false)
      return
    }

    setQuoteLoading(true)
    void requestQuote({ variables: { input: { orderId, products, promoCode: promoCode || undefined, deliveryAddress: address, deliveryMethod } } })
      .then(result => {
        if (requestId !== quoteRequestId.current) return
        if (!result.data?.checkoutQuote) {
          setQuoteError('Checkout quote is unavailable')
          return
        }
        setQuote(result.data.checkoutQuote)
        setAttemptId(createAttemptId())
      })
      .catch(error => {
        if (requestId === quoteRequestId.current) {
          setQuoteError(error instanceof Error ? error.message : 'Checkout quote could not be created')
        }
      })
      .finally(() => {
        if (requestId === quoteRequestId.current) setQuoteLoading(false)
      })
  }, [address, addressComplete, deliveryMethod, order, orderId, products, promoCode, requestQuote])

  const submit = async (cardNumber: string, cvv: string) => {
    if (!quote) return
    setSubmissionError(undefined)
    try {
      const paymentMethod = tokenizeMockPayment(cardNumber, cvv)
      const result = await submitOrder({ variables: { input: { orderId, attemptId, quoteId: quote.id, quoteFingerprint: quote.fingerprint, expectedTotalMinor: quote.totalMinor, paymentMethod } } })
      const payload = result.data?.submitOrder
      if (payload?.status === 'completed' && payload.checkout) {
        setCompletedCheckout(payload.checkout)
        await refetch()
        return
      }
      setSubmissionError(payload?.errorCode || payload?.status || 'Checkout could not be completed')
      if (payload?.status === 'payment_failed' || payload?.status === 'action_required') setAttemptId(createAttemptId())
      setPaymentFormKey(value => value + 1)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Checkout could not be completed')
      setPaymentFormKey(value => value + 1)
    }
  }

  if (orderLoading) return <p>Loading order…</p>
  if (orderError || !order) return <p className="text-red-700">Order is unavailable.</p>
  if (completedCheckout || (order.status !== 'created' && order.checkout)) return <CheckoutConfirmation checkout={completedCheckout || order.checkout!} />

  return <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-6 shadow-sm">
    <button type="button" onClick={() => history.push('/order')} className="text-sm text-blue-700">← Back to cart</button>
    <h1 className="text-3xl font-bold">Checkout</h1>
    <DeliveryForm address={address} method={deliveryMethod} onAddressChange={setAddress} onMethodChange={setDeliveryMethod} />
    <Input aria-label="Promo code" placeholder="Promo code" value={promoCode} onChange={event => setPromoCode(event.target.value)} />
    {quoteError && <p className="text-red-700">{quoteError}</p>}
    <CheckoutSummary quote={quote} loading={quoteLoading} />
    {submissionError && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{submissionError}</p>}
    <PaymentForm key={paymentFormKey} disabled={submitting || !quote || quoteLoading} quoteLoading={quoteLoading} submitting={submitting} onSubmit={submit} />
  </div>
}

export default CheckoutPage
