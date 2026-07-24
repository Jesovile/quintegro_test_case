import React from 'react'

interface Address {
  country: string
  city: string
  streetAndHouseNumber: string
  postalCode: string
  phone: string
}

interface OrderCheckoutDetailsProps {
  recipientName?: string | null
  shippingAddress?: Address | null
  billingAddress?: Address | null
  comment?: string | null
}

const formatAddress = (address: Address): string =>
  `${address.streetAndHouseNumber}, ${address.city}, ${address.postalCode}, ${address.country} — ${address.phone}`

// Read-only display of the persisted checkout data. Renders nothing for
// orders that haven't been through checkout yet (no recipient name /
// shipping address on the order).
const OrderCheckoutDetails: React.FC<OrderCheckoutDetailsProps> = ({
  recipientName,
  shippingAddress,
  billingAddress,
  comment,
}) => {
  if (!recipientName && !shippingAddress) return null

  return (
    <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-700 space-y-1">
      {recipientName && (
        <p>
          <span className="font-semibold">Recipient:</span> {recipientName}
        </p>
      )}
      {shippingAddress && (
        <p>
          <span className="font-semibold">Shipping address:</span> {formatAddress(shippingAddress)}
        </p>
      )}
      {billingAddress && (
        <p>
          <span className="font-semibold">Billing address:</span> {formatAddress(billingAddress)}
        </p>
      )}
      {comment && (
        <p>
          <span className="font-semibold">Comment:</span> {comment}
        </p>
      )}
    </div>
  )
}

export default OrderCheckoutDetails
