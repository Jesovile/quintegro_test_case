import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ORDERS } from '../graphql/queries';
import { CREATE_ORDER } from '../graphql/mutations';
import { CANCEL_ORDER } from './checkout/mutations';
import OrderListItem from './OrderListItem';
import OrderSum from './OrderSum';
import { useCheckout } from './checkout/CheckoutContext';
import { Button } from './ui/button';
import { Loader2, Plus, CreditCard, X } from 'lucide-react';

type OrderStatus =
  | 'new'
  | 'waitingPayment'
  | 'paymentProcess'
  | 'inProgress'
  | 'delivery'
  | 'done'
  | 'failed'
  | 'canceledByUser'
  | 'canceledByCompany';

interface Product {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface OrderItem {
  product: Product;
  amount: number;
  price: number;
}

interface Order {
  orderId: string;
  status: OrderStatus;
  products: OrderItem[];
  paymentId?: string;
  paymentUrl?: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  waitingPayment: 'Waiting Payment',
  paymentProcess: 'Payment Processing',
  inProgress: 'In Progress',
  delivery: 'Delivery',
  done: 'Done',
  failed: 'Failed',
  canceledByUser: 'Canceled by User',
  canceledByCompany: 'Canceled by Company',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  waitingPayment: 'bg-yellow-100 text-yellow-700',
  paymentProcess: 'bg-orange-100 text-orange-700',
  inProgress: 'bg-purple-100 text-purple-700',
  delivery: 'bg-indigo-100 text-indigo-700',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  canceledByUser: 'bg-gray-100 text-gray-600',
  canceledByCompany: 'bg-gray-100 text-gray-600',
};

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const { openCheckout } = useCheckout();

  const [cancelOrder] = useMutation(CANCEL_ORDER, {
    onCompleted: (_data, opts) => {
      const orderId = opts?.variables?.orderId as string;
      setOrders(prev => prev.map(o => o.orderId === orderId ? { ...o, status: 'canceledByUser' as OrderStatus } : o));
      setCancelingId(null);
    },
    onError: (err) => {
      console.error('Failed to cancel order:', err);
      setCancelingId(null);
    },
  });

  const handleCancel = (orderId: string) => {
    setCancelingId(orderId);
    cancelOrder({ variables: { orderId } });
  };

  const { loading, error, refetch } = useQuery(GET_ORDERS, {
    onCompleted: (data) => setOrders(data.orders || []),
    onError: (err) => console.error('GraphQL error:', err),
  });

  const [createOrder, { loading: creating }] = useMutation(CREATE_ORDER, {
    onCompleted: (data) => {
      setOrders((prev) => [...prev, data.createOrder]);
    },
    onError: (err) => console.error('Failed to create order:', err),
  });

  const handleAmountChange = (productId: string, newAmount: number) => {
    setOrders((prev) =>
      prev.map((order) => ({
        ...order,
        products: order.products.map((item) => (item.product.id === productId ? { ...item, amount: newAmount } : item)),
      })),
    );
  };

  const handleDelete = (productId: string) => {
    setOrders((prev) =>
      prev
        .map((order) => ({
          ...order,
          products: order.products.filter((item) => item.product.id !== productId),
        }))
        .filter((order) => order.products.length > 0),
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-medium">{error.message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Orders</h1>
        <Button onClick={() => createOrder()} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New Order
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No orders yet</h2>
            <p className="mt-2 text-gray-600">Click "New Order" to create your first order.</p>
          </div>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.orderId} className="mb-6 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Order #{order.orderId}</h2>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
                {order.status === 'waitingPayment' && order.paymentId && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white"
                    onClick={() =>
                      openCheckout(order.orderId, {
                        paymentId: order.paymentId!,
                        paymentUrl: order.paymentUrl ?? `/mock-bank/pay/${order.paymentId}`,
                      })
                    }
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Pay Now
                  </Button>
                )}
                {(order.status === 'new' || order.status === 'waitingPayment') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={cancelingId === order.orderId}
                    onClick={() => handleCancel(order.orderId)}
                  >
                    {cancelingId === order.orderId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />}
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {order.products.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No items in this order yet.</p>
            ) : (
              order.products.map((item, index) => (
                <OrderListItem
                  key={item.product.id}
                  product={item.product}
                  amount={item.amount}
                  price={item.price}
                  orderId={order.orderId}
                  onAmountChange={handleAmountChange}
                  onDelete={handleDelete}
                  onSubmitOrder={openCheckout}
                  status={order.status}
                  isLast={index === order.products.length - 1}
                />
              ))
            )}
            {order.status == 'new' && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => openCheckout(order.orderId)}
                  className="min-w-[120px] h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Checkout
                </Button>
              </div>
            )}

            <OrderSum orderId={order.orderId} products={order.products} />
          </div>
        ))
      )}
    </div>
  );
};

export default OrderList;
