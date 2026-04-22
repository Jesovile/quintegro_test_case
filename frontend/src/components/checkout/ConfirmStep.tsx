import React from 'react'
import { Button } from '@/components/ui/button'
import { Order, Shipping } from '../../types/order'
import { CardDraft } from './PaymentForm'
import OrderSum from '../OrderSum'
import { Loader2 } from 'lucide-react'

interface Props {
  order: Order
  shipping: Shipping
  card: CardDraft
  busy: boolean
  error?: string | null
  onBack: () => void
  onPlace: () => void
  onCancel: () => void
}

const ConfirmStep: React.FC<Props> = ({ order, shipping, card, busy, error, onBack, onPlace, onCancel }) => {
  const last4 = card.number.slice(-4)

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6 text-gray-900">Confirm and pay</h2>

      <div className="space-y-6">
        <section className="p-4 border border-gray-200 rounded-lg bg-white">
          <p className="font-medium text-gray-800 mb-2">Items</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {order.products.map(p => (
              <li key={p.product.id} className="flex justify-between">
                <span>{p.product.title} × {p.amount}</span>
                <span>${(p.amount * p.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-4 border border-gray-200 rounded-lg bg-white">
          <p className="font-medium text-gray-800 mb-2">Shipping</p>
          <div className="text-sm text-gray-600">
            <p>{shipping.fullName}</p>
            <p>{shipping.address}, {shipping.city}, {shipping.zip}, {shipping.country}</p>
            <p>{shipping.phone}</p>
          </div>
        </section>

        <section className="p-4 border border-gray-200 rounded-lg bg-white">
          <p className="font-medium text-gray-800 mb-2">Payment</p>
          <p className="text-sm text-gray-600">
            Card ending in {last4} ({card.holderName})
          </p>
        </section>

        <OrderSum orderId={order.orderId} products={order.products} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          className="text-red-600 hover:bg-red-50"
        >
          Cancel order
        </Button>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button
            onClick={onPlace}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Placing...
              </span>
            ) : (
              'Place order'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmStep
