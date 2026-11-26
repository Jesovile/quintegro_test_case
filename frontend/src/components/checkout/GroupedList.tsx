// Building blocks in the style of Apple's "inset grouped" lists:
// a section header, a rounded white group of 44pt+ rows with inset separators,
// and an optional footer note.
import React from 'react'
import { cn } from '@/lib/utils'

/** Inset hairline above every row except the first one in a group. */
export const rowSeparator =
  "relative not-first:before:absolute not-first:before:top-0 not-first:before:left-4 not-first:before:right-0 not-first:before:border-t not-first:before:border-black/10 not-first:before:content-['']"

interface SectionProps {
  id?: string
  title: string
  footer?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}

export const Section: React.FC<SectionProps> = ({ id, title, footer, action, children }) => (
  <section id={id} aria-label={title} className="mb-8 scroll-mt-6">
    <div className="mx-4 mb-1.5 flex items-baseline justify-between">
      <h2 className="text-[13px] font-normal uppercase tracking-wide text-gray-500">{title}</h2>
      {action}
    </div>
    {children}
    {footer && <div className="mx-4 mt-1.5 text-[13px] leading-snug text-gray-500">{footer}</div>}
  </section>
)

// No overflow-hidden: popovers (address select) must be able to overlay the
// content below. First and last rows get the rounded corners instead.
export const Group: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      'rounded-xl bg-white shadow-sm ring-1 ring-black/[.06] [&>*:first-child]:rounded-t-xl [&>*:last-child]:rounded-b-xl',
      className,
    )}
  >
    {children}
  </div>
)

/**
 * Label line of a field. The error is shown on the same line, right-aligned,
 * so showing or hiding it never changes the row height.
 */
export const FieldLabel: React.FC<{ id: string; label: string; error?: string }> = ({ id, label, error }) => (
  <span className="flex items-baseline justify-between gap-3 text-xs leading-4">
    <span className={cn('shrink-0', error ? 'text-[#ff3b30]' : 'text-gray-500')}>{label}</span>
    {error && (
      <span id={`${id}-error`} role="alert" className="min-w-0 text-right text-[#ff3b30]">
        {error}
      </span>
    )}
  </span>
)

/* ------------------------------- Text field ------------------------------- */

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  id: string
  label: string
  error?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, error, prefix, suffix, className, ...inputProps }, ref) => (
    <label
      htmlFor={id}
      className={cn(
        rowSeparator,
        'block min-h-[52px] cursor-text px-4 py-2 transition-colors focus-within:bg-[#007aff]/[.04]',
        className,
      )}
    >
      <FieldLabel id={id} label={label} error={error} />
      <span className="flex items-center gap-1.5">
        {prefix && <span className="shrink-0 text-[15px] text-gray-500">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full min-w-0 bg-transparent py-0.5 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
          {...inputProps}
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </span>
    </label>
  ),
)
Field.displayName = 'Field'

/* --------------------------- Selectable option row -------------------------- */

interface OptionRowProps {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onSelect: (value: string) => void
  icon: React.ReactNode
  iconClassName: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
}

/** A radio input rendered as an iOS list row with a checkmark. */
export const OptionRow: React.FC<OptionRowProps> = ({
  name,
  value,
  checked,
  disabled,
  onSelect,
  icon,
  iconClassName,
  title,
  subtitle,
  trailing,
}) => (
  <label
    className={cn(
      rowSeparator,
      'flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors has-[:focus-visible]:bg-[#007aff]/[.06]',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-black/[.02]',
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      disabled={disabled}
      onChange={() => onSelect(value)}
      className="sr-only"
    />
    <span className={cn('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[7px] text-white', iconClassName)}>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] text-gray-900">{title}</span>
      {subtitle && <span className="block text-[13px] text-gray-500">{subtitle}</span>}
    </span>
    {trailing && <span className="text-[15px] text-gray-500">{trailing}</span>}
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cn('h-4 w-4 shrink-0 text-[#007aff]', checked ? 'visible' : 'invisible')}
    >
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </label>
)
