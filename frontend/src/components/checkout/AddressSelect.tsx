// Searchable address select.
// The trigger looks like a field; opening it shows a popover with a search box
// and the first addresses right away. Typing is debounced before querying the
// backend. The popover overlays the page, so nothing below it moves.
import React, { useEffect, useId, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import { ChevronDown, Loader2, MapPin, Search } from 'lucide-react'
import { SEARCH_ADDRESSES } from '@/graphql/queries'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { Address, formatAddress } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { FieldLabel, rowSeparator } from './GroupedList'

export const ADDRESS_SEARCH_DEBOUNCE_MS = 300
const RESULT_LIMIT = 20

interface SearchState {
  results: Address[]
  loading: boolean
  failed: boolean
}

/**
 * Runs the search for `query` while `enabled`. Responses for outdated queries
 * are dropped, previous results stay visible while the next request is in flight,
 * and `retry` forces a fresh network request after a failure.
 */
function useAddressSearch(query: string, enabled: boolean) {
  const client = useApolloClient()
  const [state, setState] = useState<SearchState>({ results: [], loading: false, failed: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let stale = false
    setState((s) => ({ ...s, loading: true, failed: false }))
    client
      .query<{ searchAddresses: Address[] }>({
        query: SEARCH_ADDRESSES,
        variables: { query, limit: RESULT_LIMIT },
        fetchPolicy: attempt > 0 ? 'network-only' : 'cache-first',
      })
      .then((res) => {
        if (stale) return
        if (res.data?.searchAddresses) {
          setState({ results: res.data.searchAddresses, loading: false, failed: false })
        } else {
          setState((s) => ({ ...s, loading: false, failed: true }))
        }
      })
      .catch(() => {
        if (!stale) setState((s) => ({ ...s, loading: false, failed: true }))
      })
    return () => {
      stale = true
    }
  }, [client, query, enabled, attempt])

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

interface Props {
  id: string
  label: string
  value: Address | null
  onChange: (address: Address) => void
  /** Called when the select is closed without staying inside it (for "touched"). */
  onBlur: () => void
  error?: string
}

const AddressSelect: React.FC<Props> = ({ id, label, value, onChange, onBlur, error }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listboxId = `${uid}-listbox`
  const optionId = (i: number) => `${uid}-option-${i}`

  const debounced = useDebouncedValue(query.trim(), ADDRESS_SEARCH_DEBOUNCE_MS)
  const { results, loading, failed, retry } = useAddressSearch(debounced, open)
  const typing = query.trim() !== debounced
  const busy = typing || loading

  useEffect(() => {
    if (open) {
      setQuery('')
      searchRef.current?.focus()
    }
  }, [open])

  // Highlight the selected address (or the first result) whenever results change.
  useEffect(() => {
    const selectedIndex = value ? results.findIndex((a) => a.id === value.id) : -1
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : results.length ? 0 : -1)
  }, [results, value])

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  const choose = (address: Address) => {
    onChange(address)
    close(true)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (results.length) setActiveIndex((i) => Math.min(results.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (results.length) setActiveIndex((i) => Math.max(0, i - 1))
        break
      case 'Enter':
        e.preventDefault() // never submit the surrounding form from here
        if (!busy && results[activeIndex]) choose(results[activeIndex])
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
    }
  }

  // Leaving the whole widget (click outside / tab away) closes it and marks it touched.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (rootRef.current?.contains(e.relatedTarget as Node | null)) return
    setOpen(false)
    onBlur()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        onBlur()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onBlur])

  let status: React.ReactNode = null
  if (failed && !busy) {
    status = (
      <span className="flex items-center justify-between gap-3">
        <span className="text-[#ff3b30]">Couldn't load addresses.</span>
        <button type="button" onClick={retry} className="font-medium text-[#007aff] hover:underline">
          Try Again
        </button>
      </span>
    )
  } else if (busy && results.length === 0) {
    status = 'Searching…'
  } else if (!busy && results.length === 0) {
    status = debounced ? `No addresses found for “${debounced}”` : 'No addresses available'
  }

  return (
    <div ref={rootRef} className={cn(rowSeparator, open && 'z-30')} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        className="block min-h-[52px] w-full px-4 py-2 text-left transition-colors focus-visible:bg-[#007aff]/[.06] focus-visible:outline-none"
      >
        <FieldLabel id={id} label={label} error={error} />
        <span className="flex items-center gap-2 py-0.5">
          <MapPin className={cn('h-4 w-4 shrink-0', value ? 'text-[#007aff]' : 'text-gray-400')} aria-hidden="true" />
          <span className={cn('min-w-0 flex-1 truncate text-[15px]', value ? 'text-gray-900' : 'text-gray-400')}>
            {value ? formatAddress(value) : 'Select your address'}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10">
          <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              autoComplete="off"
              spellCheck={false}
              placeholder="Street, city or ZIP code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full min-w-0 bg-transparent py-1 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
            />
            <Loader2
              className={cn('h-4 w-4 shrink-0 animate-spin text-gray-400', !busy && 'invisible')}
              aria-hidden={!busy}
              aria-label="Searching"
            />
          </div>

          <ul id={listboxId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1">
            {results.map((address, i) => {
              const selected = value?.id === address.id
              return (
                <li
                  key={address.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(address)}
                  onMouseMove={() => setActiveIndex(i)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
                    i === activeIndex && 'bg-[#007aff]/10',
                    busy && 'opacity-60',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-gray-900">
                      <Highlight text={address.line1} query={debounced} />
                    </span>
                    <span className="block text-[13px] text-gray-500">
                      <Highlight text={`${address.city}, ${address.state} ${address.zip}`} query={debounced} />
                    </span>
                  </span>
                  {selected && (
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#007aff]">
                      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              )
            })}
          </ul>

          {status && (
            <div role="status" aria-live="polite" className="px-3 py-3 text-[13px] text-gray-500">
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Bolds every query word found in the text. */
const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const tokens = query
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (tokens.length === 0) return <>{text}</>
  const parts = text.split(new RegExp(`(${tokens.join('|')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {part}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

export default AddressSelect
