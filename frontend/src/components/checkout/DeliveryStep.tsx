import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { useHistory } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import AddressForm, { AddressErrors } from './AddressForm'
import DeliveryOptions, { type DeliveryOption } from './DeliveryOptions'
import { SET_ORDER_ADDRESSES } from '@/graphql/mutations'
import { DELIVERY_RATES } from '@/graphql/queries'
import {
  addressSchema,
  deliveryStepSchema,
  type AddressInput,
  type DeliveryStepInput,
} from '@/lib/checkoutSchemas'

interface OrderProductLine {
  amount: number
  price: number
}

interface DeliveryStepProps {
  orderId: string
  products: OrderProductLine[]
  initialDelivery?: AddressInput
  initialInvoice?: AddressInput
  initialDeliveryOption?: DeliveryOption
}

interface DeliveryRates {
  fast: number
  super_fast: number
  extra_fast: number
}

const emptyAddress = (): AddressInput => ({
  fullName: '',
  phone: '',
  country: '',
  state: '',
  city: '',
  postalCode: '',
  street: '',
  apartment: '',
})

const isAddressComplete = (a: AddressInput): boolean =>
  !!(a.country.trim() && a.state.trim() && a.city.trim() && a.postalCode.trim() && a.street.trim())

const DeliveryStep: React.FC<DeliveryStepProps> = ({
  orderId,
  products,
  initialDelivery,
  initialInvoice,
  initialDeliveryOption,
}) => {
  const history = useHistory()
  const [delivery, setDelivery] = useState<AddressInput>(initialDelivery ?? emptyAddress())
  const [invoice, setInvoice] = useState<AddressInput>(initialInvoice ?? emptyAddress())
  const [sameAsDelivery, setSameAsDelivery] = useState<boolean>(
    !initialInvoice || JSON.stringify(initialDelivery) === JSON.stringify(initialInvoice)
  )
  const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(
    initialDeliveryOption ?? 'super_fast'
  )
  const [deliveryErrors, setDeliveryErrors] = useState<AddressErrors>({})
  const [invoiceErrors, setInvoiceErrors] = useState<AddressErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const subtotal = useMemo(
    () => products.reduce((sum, p) => sum + p.amount * p.price, 0),
    [products]
  )

  const deliveryReady = isAddressComplete(delivery)
  const { data: ratesData, loading: ratesLoading } = useQuery<{
    deliveryRates: DeliveryRates | null
  }>(DELIVERY_RATES, {
    variables: {
      address: {
        fullName: delivery.fullName || 'placeholder',
        phone: delivery.phone || '+0',
        country: delivery.country,
        state: delivery.state,
        city: delivery.city,
        postalCode: delivery.postalCode,
        street: delivery.street,
        apartment: delivery.apartment || null,
      },
    },
    skip: !deliveryReady,
    fetchPolicy: 'cache-first',
  })
  const rates = ratesData?.deliveryRates ?? null

  const [setAddresses, { loading }] = useMutation(SET_ORDER_ADDRESSES, {
    onCompleted: () => {
      history.push(`/checkout/${orderId}/payment`)
    },
    onError: (e) => {
      setSubmitError(e.message)
    },
  })

  const deliveryPrice = rates?.[deliveryOption] ?? 0
  const total = subtotal + deliveryPrice

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    setDeliveryErrors({})
    setInvoiceErrors({})

    const payload: DeliveryStepInput = {
      deliveryAddress: delivery,
      sameAsDelivery,
      invoiceAddress: sameAsDelivery ? undefined : invoice,
    }

    const parsed = deliveryStepSchema.safeParse(payload)
    if (!parsed.success) {
      const dErrs: AddressErrors = {}
      const iErrs: AddressErrors = {}
      for (const issue of parsed.error.issues) {
        const [root, key] = issue.path
        if (root === 'deliveryAddress' && typeof key === 'string') {
          dErrs[key as keyof AddressInput] = issue.message
        } else if (root === 'invoiceAddress' && typeof key === 'string') {
          iErrs[key as keyof AddressInput] = issue.message
        } else if (root === 'invoiceAddress') {
          setSubmitError(issue.message)
        }
      }
      setDeliveryErrors(dErrs)
      setInvoiceErrors(iErrs)
      return
    }

    if (!rates) {
      setSubmitError('Pick a verified delivery address to load rates.')
      return
    }

    setAddresses({
      variables: {
        input: {
          orderId,
          deliveryAddress: addressSchema.parse(parsed.data.deliveryAddress),
          invoiceAddress: parsed.data.sameAsDelivery
            ? null
            : parsed.data.invoiceAddress
            ? addressSchema.parse(parsed.data.invoiceAddress)
            : null,
          sameAsDelivery: parsed.data.sameAsDelivery,
          deliveryOption,
        },
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery address</h2>
          <AddressForm
            idPrefix="delivery"
            value={delivery}
            errors={deliveryErrors}
            onChange={setDelivery}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Invoice address</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsDelivery}
                onChange={(e) => setSameAsDelivery(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Use the same address for invoice
            </label>
          </div>

          {sameAsDelivery ? (
            <p className="text-sm text-gray-600">
              Invoice address will match the delivery address.
            </p>
          ) : (
            <AddressForm
              idPrefix="invoice"
              value={invoice}
              errors={invoiceErrors}
              onChange={setInvoice}
              disabled={loading}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <DeliveryOptions
            value={deliveryOption}
            onChange={setDeliveryOption}
            rates={rates}
            loading={ratesLoading}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order summary</h2>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Items subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>
              Delivery {rates ? <span className="text-gray-500">(selected option)</span> : null}
            </span>
            <span>{rates ? `$${deliveryPrice.toFixed(2)}` : '—'}</span>
          </div>
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => history.push('/order')}
          disabled={loading}
        >
          Back to cart
        </Button>
        <Button type="submit" disabled={loading || !rates} className="min-w-[160px]">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            'Continue to payment'
          )}
        </Button>
      </div>
    </form>
  )
}

export default DeliveryStep
