import React from 'react'
import { CheckoutQuote } from '../../lib/checkoutTypes'

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`

const CheckoutSummary: React.FC<{ quote?: CheckoutQuote; loading: boolean }> = ({ quote, loading }) => <section className="rounded border bg-slate-50 p-5 space-y-2">
  <h2 className="text-xl font-semibold">Order summary</h2>
  {loading && <p>Updating quote…</p>}
  {quote && <>
    <p>Items: {money(quote.subtotalMinor)}</p>
    <p>Discount: −{money(quote.discountMinor)}</p>
    <p>Delivery: {money(quote.deliveryFeeMinor)}</p>
    <p className="border-t pt-2 text-lg font-bold">Total: {money(quote.totalMinor)}</p>
  </>}
</section>

export default CheckoutSummary
