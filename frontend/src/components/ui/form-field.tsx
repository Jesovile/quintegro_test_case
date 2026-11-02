import * as React from 'react'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}

// Label bound to the control, required/optional mark and the error linked through aria-describedby
export const FormField: React.FC<FormFieldProps> = ({ id, label, required = false, error, className, children }) => (
  <div className={className}>
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
      {label}
      {required ? (
        <span className="text-red-600" aria-hidden="true"> *</span>
      ) : (
        <span className="font-normal text-gray-500"> (optional)</span>
      )}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
        {error}
      </p>
    )}
  </div>
)

export const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
