import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoadingStateProps {
  label: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label }) => (
  <div className="flex justify-center py-12" role="status">
    <div className="text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-4 text-gray-600">{label}</p>
    </div>
  </div>
)

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
    <p className="text-sm font-medium">{message}</p>
    <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
      Try again
    </Button>
  </div>
)

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => (
  <div className="text-center py-12">
    <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-gray-600">{description}</p>
      {action}
    </div>
  </div>
)
