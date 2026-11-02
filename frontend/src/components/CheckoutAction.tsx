import React from 'react'
import { Link, useHistory } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { START_CHECKOUT } from '@/graphql/mutations'
import { Button } from '@/components/ui/button'
import { checkoutPath } from '@/lib/checkoutSteps'
import { getErrorMessage } from '@/lib/graphqlErrors'
import { Order } from '@/types/order'

interface CheckoutActionProps {
  order: Order
}

const CheckoutAction: React.FC<CheckoutActionProps> = ({ order }) => {
  const history = useHistory()
  const [startCheckout, { loading, error }] = useMutation(START_CHECKOUT, {
    onCompleted: () => history.push(checkoutPath(order.orderId)),
    // Failures are shown below the button
    onError: () => undefined
  })

  if (order.status === 'checkout') {
    return (
      <div className="mt-6 flex justify-end">
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link to={checkoutPath(order.orderId)}>Continue checkout</Link>
        </Button>
      </div>
    )
  }

  // An empty order shows its own message instead of the button
  if (order.status !== 'created' || order.products.length === 0) {
    return null
  }

  return (
    <div className="mt-6 flex flex-col items-end gap-2">
      <Button
        className="min-w-[8rem] bg-blue-600 hover:bg-blue-700 text-white"
        loading={loading}
        onClick={() => startCheckout({ variables: { orderId: order.orderId } })}
      >
        Checkout
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {getErrorMessage(error)}
        </p>
      )}
    </div>
  )
}

export default CheckoutAction
