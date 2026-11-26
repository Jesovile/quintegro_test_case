import React from 'react'
import { rowSeparator } from './GroupedList'

export const SkeletonRows: React.FC<{ count: number }> = ({ count }) => (
  <div aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={`${rowSeparator} flex min-h-[52px] items-center gap-3 px-4 py-2.5`}>
        <span className="h-[30px] w-[30px] animate-pulse rounded-[7px] bg-gray-200" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-3 w-24 animate-pulse rounded bg-gray-200" />
          <span className="block h-2.5 w-40 animate-pulse rounded bg-gray-100" />
        </span>
      </div>
    ))}
  </div>
)

export const LoadError: React.FC<{ message: string; onRetry: () => void; className?: string }> = ({
  message,
  onRetry,
  className = '',
}) => (
  <div role="alert" className={`flex items-center justify-between gap-3 px-4 py-3 text-[13px] ${className}`}>
    <span className="text-[#ff3b30]">{message}</span>
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRetry}
      className="shrink-0 font-medium text-[#007aff] hover:underline"
    >
      Try Again
    </button>
  </div>
)
