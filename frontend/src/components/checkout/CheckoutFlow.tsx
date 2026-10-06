import React, { useState } from 'react'
import CheckoutFormStep, { CheckoutFormData, EMPTY_FORM } from './CheckoutFormStep'
import PaymentStep from './PaymentStep'
import PaymentResultStep from './PaymentResultStep'

type Step = 'form' | 'payment' | 'result'

interface PaymentInfo {
  paymentId: string
  paymentUrl: string
}

interface Props {
  orderId: string
  onClose: () => void
  onComplete: () => void
  initialPaymentInfo?: PaymentInfo
}

const STEP_TITLE: Record<Step, string> = {
  form: 'Checkout',
  payment: 'Payment',
  result: 'Result',
}

const CheckoutFlow: React.FC<Props> = ({ orderId, onClose, onComplete, initialPaymentInfo }) => {
  const [step, setStep] = useState<Step>(initialPaymentInfo ? 'payment' : 'form')
  const [formData, setFormData] = useState<CheckoutFormData>(EMPTY_FORM)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(initialPaymentInfo ?? null)
  const [resultStatus, setResultStatus] = useState<'inProgress' | 'failed' | null>(null)

  const handleFormSuccess = (result: { paymentId: string; paymentUrl: string }) => {
    setPaymentInfo(result)
    setStep('payment')
  }

  const handlePaymentResult = (status: 'inProgress' | 'failed') => {
    setResultStatus(status)
    setStep('result')
  }

  const handleClose = () => {
    onComplete()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{STEP_TITLE[step]}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 'form' && (
            <CheckoutFormStep
              orderId={orderId}
              formData={formData}
              onChange={setFormData}
              onSuccess={handleFormSuccess}
              onCancel={onClose}
            />
          )}

          {step === 'payment' && paymentInfo && (
            <PaymentStep
              paymentId={paymentInfo.paymentId}
              paymentUrl={paymentInfo.paymentUrl}
              onSuccess={handlePaymentResult}
              onBack={() => setStep('form')}
            />
          )}

          {step === 'result' && resultStatus && (
            <PaymentResultStep
              status={resultStatus}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckoutFlow
