import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useHistory, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { GET_ORDER } from '@/graphql/queries'

type Order = { orderId: string; status: string }

const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const history = useHistory()
  const { data, loading, error } = useQuery<{ order: Order }>(GET_ORDER, { variables: { orderId }, fetchPolicy: 'network-only' })
  const order = data?.order

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
  if (error || !order) return <div className="mx-auto max-w-xl rounded-md border border-red-200 bg-red-50 p-5 text-red-700">Не удалось получить актуальный статус заказа.</div>
  const isAccepted = order.status === 'submited' || order.status === 'finished'

  return <Card className="mx-auto max-w-xl"><CardContent className="p-8 text-center">{isAccepted ? <><CheckCircle2 className="mx-auto h-14 w-14 text-green-600" /><h1 className="mt-4 text-3xl font-bold text-gray-900">Заказ принят</h1><p className="mt-2 text-gray-600">Заказ №{order.orderId} успешно принят в обработку.</p><p className="mt-6 rounded-lg bg-gray-50 p-5 text-sm text-gray-700"><strong>Статус:</strong> {order.status === 'finished' ? 'Завершён' : 'Заказ принят'}</p></> : <><h1 className="text-2xl font-bold text-gray-900">Статус заказа не подтверждён</h1><p className="mt-2 text-gray-600">Обновите страницу заказов через несколько секунд.</p></>}<Button className="mt-6" onClick={() => history.push('/order')}>К заказам</Button></CardContent></Card>
}

export default OrderConfirmationPage
