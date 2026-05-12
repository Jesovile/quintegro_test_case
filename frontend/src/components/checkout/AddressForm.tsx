import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@apollo/client'
import { CheckCircle2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SEARCH_ADDRESSES } from '@/graphql/queries'
import type { AddressInput } from '@/lib/checkoutSchemas'
import { DIAL_CODES, formatPhone, lookupDialCode, parsePhone } from '@/lib/dialCodes'

export type AddressErrors = Partial<Record<keyof AddressInput, string>>

interface Suggestion {
  id: string
  description: string
  country: string
  state: string
  city: string
  postalCode: string
  street: string
}

interface AddressFormProps {
  idPrefix: string
  value: AddressInput
  errors?: AddressErrors
  onChange: (next: AddressInput) => void
  disabled?: boolean
}

const fields: Array<{
  key: keyof AddressInput
  label: string
  colSpan?: 1 | 2
  autoComplete?: string
}> = [
  { key: 'fullName', label: 'Full name', colSpan: 2, autoComplete: 'name' },
  { key: 'phone', label: 'Phone', colSpan: 2, autoComplete: 'tel' },
  { key: 'country', label: 'Country', autoComplete: 'country-name' },
  { key: 'state', label: 'State / region', autoComplete: 'address-level1' },
  { key: 'city', label: 'City', autoComplete: 'address-level2' },
  { key: 'postalCode', label: 'Postal code', autoComplete: 'postal-code' },
  { key: 'street', label: 'Street', colSpan: 2, autoComplete: 'street-address' },
  { key: 'apartment', label: 'Apartment, suite (optional)', colSpan: 2, autoComplete: 'address-line2' },
]

const norm = (s: string) => s.trim().toLowerCase()
const locationMatches = (s: Suggestion, a: AddressInput): boolean =>
  norm(a.country) === norm(s.country) &&
  norm(a.state) === norm(s.state) &&
  norm(a.city) === norm(s.city) &&
  norm(a.postalCode) === norm(s.postalCode) &&
  norm(a.street) === norm(s.street)

const AddressForm: React.FC<AddressFormProps> = ({ idPrefix, value, errors, onChange, disabled }) => {
  const { data } = useQuery<{ searchAddresses: Suggestion[] }>(SEARCH_ADDRESSES, {
    variables: { query: '' },
    fetchPolicy: 'cache-first',
  })
  const suggestions = data?.searchAddresses ?? []

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = norm(query)
    if (!q) return suggestions
    return suggestions.filter((s) =>
      norm(`${s.description} ${s.street} ${s.city} ${s.state} ${s.country} ${s.postalCode}`).includes(q)
    )
  }, [query, suggestions])

  const verified = useMemo(
    () => suggestions.some((s) => locationMatches(s, value)),
    [suggestions, value]
  )

  const update = (key: keyof AddressInput, v: string) => {
    onChange({ ...value, [key]: v })
  }

  const { dial, local: phoneLocal } = parsePhone(value.phone)

  // Auto-pick the dial code when the country changes to one we recognize.
  useEffect(() => {
    const inferred = lookupDialCode(value.country)
    if (inferred && inferred !== dial) {
      onChange({ ...value, phone: formatPhone(inferred, phoneLocal) })
    }
    // We intentionally depend only on `value.country` — re-firing when phone
    // changes would clobber the user's manual dial-code selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.country])

  const updatePhone = (nextDial: string, nextLocal: string) => {
    onChange({ ...value, phone: formatPhone(nextDial, nextLocal) })
  }

  const pickSuggestion = (s: Suggestion) => {
    onChange({
      ...value,
      country: s.country,
      state: s.state,
      city: s.city,
      postalCode: s.postalCode,
      street: s.street,
    })
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div ref={wrapperRef} className="relative">
        <label
          htmlFor={`${idPrefix}-address-search`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Search verified address (Google)
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <Input
            id={`${idPrefix}-address-search`}
            placeholder="Start typing a city, street, or postal code…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                >
                  <div className="text-sm font-medium text-gray-900">{s.street}</div>
                  <div className="text-xs text-gray-500">
                    {s.city}, {s.state} {s.postalCode} · {s.country}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg px-3 py-2 text-sm text-gray-500">
            No matching verified addresses
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Pick a suggestion — only addresses verified by Google can be used.
        </p>
        {verified && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Address verified by Google
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => {
          const id = `${idPrefix}-${f.key}`
          const err = errors?.[f.key]

          if (f.key === 'phone') {
            const dialId = `${idPrefix}-phone-dial`
            return (
              <div key={f.key} className="sm:col-span-2">
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label}
                </label>
                <div className="flex gap-2">
                  <select
                    id={dialId}
                    value={dial}
                    onChange={(e) => updatePhone(e.target.value, phoneLocal)}
                    disabled={disabled}
                    aria-label="Country code"
                    className="flex h-10 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">+ Code</option>
                    {DIAL_CODES.map((c) => (
                      <option key={c.label} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    id={id}
                    name={id}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="555 123 4567"
                    value={phoneLocal}
                    onChange={(e) =>
                      updatePhone(dial, e.target.value.replace(/\D/g, '').slice(0, 15))
                    }
                    disabled={disabled}
                    aria-invalid={err ? true : undefined}
                    className={`flex-1 ${err ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                </div>
                {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
              </div>
            )
          }

          return (
            <div key={f.key} className={f.colSpan === 2 ? 'sm:col-span-2' : undefined}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}
              </label>
              <Input
                id={id}
                name={id}
                autoComplete={f.autoComplete}
                value={value[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                disabled={disabled}
                aria-invalid={err ? true : undefined}
                className={err ? 'border-red-500 focus-visible:ring-red-500' : undefined}
              />
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AddressForm
