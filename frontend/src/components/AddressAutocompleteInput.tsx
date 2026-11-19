import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { addressAutocompleteProvider } from '@/address/addressAutocompleteProvider'
import type { AddressSuggestion } from '@/address/addressAutocomplete'
import { Input } from '@/components/ui/input'

type Props = {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: AddressSuggestion) => void
  id?: string
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const HighlightedSuggestion: React.FC<{ label: string; query: string }> = ({ label, query }) => {
  const fragments = Array.from(new Set(query.trim().split(/\s+/).filter(fragment => fragment.length >= 2)))
  if (!fragments.length) return <>{label}</>

  const pattern = new RegExp(`(${fragments.map(escapeRegExp).join('|')})`, 'giu')
  const matcher = new RegExp(`^(?:${fragments.map(escapeRegExp).join('|')})$`, 'iu')
  return <>{label.split(pattern).map((part, index) => matcher.test(part)
    ? <mark key={index} className="rounded bg-amber-100 px-0.5 text-inherit">{part}</mark>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>
}

export const AddressAutocompleteInput: React.FC<Props> = ({ value, onChange, onSelect, id }) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const selectedValue = useRef(value)

  useEffect(() => {
    if (value.trim().length < 3 || selectedValue.current === value) {
      setSuggestions([])
      setActiveIndex(-1)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(false)
      try {
        setSuggestions(await addressAutocompleteProvider.suggest(value, { signal: controller.signal }))
        setActiveIndex(-1)
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setSuggestions([])
          setActiveIndex(-1)
          setError(true)
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value])

  const select = (suggestion: AddressSuggestion) => {
    selectedValue.current = suggestion.addressLine1 ?? suggestion.label
    onSelect(suggestion)
    setSuggestions([])
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSuggestions([])
      setActiveIndex(-1)
      return
    }
    if (!suggestions.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      select(suggestions[activeIndex])
    }
  }

  return <div className="relative">
    <Input
      id={id}
      value={value}
      onChange={event => {
        selectedValue.current = ''
        onChange(event.target.value)
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => window.setTimeout(() => {
        setSuggestions([])
        setActiveIndex(-1)
      }, 150)}
      autoComplete="street-address"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={suggestions.length > 0}
      aria-controls={id ? `${id}-suggestions` : undefined}
      aria-activedescendant={activeIndex >= 0 && id ? `${id}-option-${activeIndex}` : undefined}
    />
    {isLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" aria-label="Ищем адреса" />}
    {suggestions.length > 0 && <ul id={id ? `${id}-suggestions` : undefined} role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
      {suggestions.map((suggestion, index) => <li key={suggestion.id} id={id ? `${id}-option-${index}` : undefined} role="option" aria-selected={activeIndex === index}>
        <button type="button" className={`w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 ${activeIndex === index ? 'bg-blue-50' : ''}`} onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => select(suggestion)}><HighlightedSuggestion label={suggestion.label} query={value} /></button>
      </li>)}
    </ul>}
    {error && <p className="mt-1 text-sm font-normal text-amber-700">Подсказки адресов временно недоступны.</p>}
  </div>
}
