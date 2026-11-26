import React, { useCallback, useState } from 'react'

/**
 * "Reward early, punish late" error display:
 * - a field shows its error only after it was left (blur) with something typed
 *   in it, or after the customer pressed Continue / Place Order. Tabbing through
 *   an empty field never flags it as "required";
 * - while typing, a visible error disappears as soon as the value is valid;
 * - a new error never pops up mid-typing.
 */
export function useTouchedFields<F extends string>(errors: Partial<Record<F, string>>) {
  const [touched, setTouched] = useState<ReadonlySet<F>>(new Set())

  const visibleError = (field: F) => (touched.has(field) ? errors[field] : undefined)

  const touch = useCallback(
    (field: F) => setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field))),
    [],
  )

  /** Call on change: stops tracking a field that isn't showing an error right now. */
  const untouchIfQuiet = (field: F) => {
    if (visibleError(field)) return
    setTouched((prev) => {
      if (!prev.has(field)) return prev
      const copy = new Set(prev)
      copy.delete(field)
      return copy
    })
  }

  const touchAll = (fields: F[]) => setTouched(new Set(fields))

  return { visibleError, touch, untouchIfQuiet, touchAll }
}

/** Focuses an element by id after the next paint (it may be mounting right now). */
export const focusLater = (id: string) =>
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })

/**
 * Enter inside a text field moves to the next field (like "Next" on the iOS
 * keyboard) instead of submitting the form and flagging every empty field.
 * Only the explicit Continue / Place Order buttons validate the whole form.
 */
export function moveFocusOnEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || e.defaultPrevented) return
  const target = e.target as HTMLElement
  if (!(target instanceof HTMLInputElement) || ['checkbox', 'radio'].includes(target.type)) return
  e.preventDefault()
  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([disabled]), [role=combobox]:not(input)',
    ),
  )
  const next = fields[fields.indexOf(target) + 1]
  if (next) next.focus()
  else target.blur()
}
