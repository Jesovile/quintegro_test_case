import { useState } from 'react'
import { useApolloClient, useMutation } from '@apollo/client'
import { PAY_ORDER } from '@/graphql/mutations'
import { GET_CHECKOUT_ORDER } from '@/graphql/queries'
import { cardTokenizer } from '@/integrations/cardTokenizer'
import { CardFormValues } from '@/lib/cardValidation'
import { getErrorCode, isRetryable } from '@/lib/graphqlErrors'
import { Order } from '@/types/order'

// Codes after which the order on screen is outdated (new total, payment dropped)
const REFRESH_ORDER_CODES = ['TOTAL_CHANGED', 'PAYMENT_REFUNDED', 'REFUND_PENDING']

// Tokenizes the card and pays; keeps the last token so an unanswered payment can be checked without a new charge
export const usePayOrder = (order: Order, onPaid: () => void) => {
  const client = useApolloClient()
  const [tokenizing, setTokenizing] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [lastToken, setLastToken] = useState<string | null>(null)

  const [payOrder, payState] = useMutation(PAY_ORDER, {
    onCompleted: onPaid,
    onError: (error) => {
      if (REFRESH_ORDER_CODES.includes(getErrorCode(error) ?? '')) {
        client.refetchQueries({ include: [GET_CHECKOUT_ORDER] })
      }
      // Only an outage or a lost answer is worth repeating with the same card
      if (!isRetryable(error)) {
        setLastToken(null)
      }
    }
  })

  const pay = (cardToken: string) =>
    payOrder({ variables: { orderId: order.orderId, input: { cardToken, expectedTotal: order.totals.total } } })

  const submit = async (card: CardFormValues) => {
    setTokenError(null)
    setTokenizing(true)
    try {
      const { cardToken } = await cardTokenizer.tokenizeCard(card)
      setLastToken(cardToken)
      pay(cardToken)
    } catch {
      setTokenError('We could not process the card details. Please try again.')
    } finally {
      setTokenizing(false)
    }
  }

  const retry = () => {
    if (lastToken) {
      pay(lastToken)
    }
  }

  const error = payState.error
  const busy = tokenizing || payState.loading

  return {
    submit,
    retry,
    busy,
    error,
    tokenError,
    canRetry: Boolean(error && lastToken && isRetryable(error)),
    // The bank may have taken the money: no new card or charge until the payment is checked
    awaitingConfirmation: Boolean(error && lastToken && getErrorCode(error) === 'PAYMENT_UNCONFIRMED'),
    // A different card makes the remembered token stale
    forgetCard: () => setLastToken(null)
  }
}
