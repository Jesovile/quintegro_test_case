import React from 'react'
import { useParams } from 'react-router-dom'
import CheckoutForm from '../components/CheckoutForm'

const CheckoutPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  return <CheckoutForm orderId={orderId} />
}

export default CheckoutPage
