// Delivery options come from the backend (mock of our delivery partner API).
// Dates are "YYYY-MM-DD" and times "HH:mm" wall-clock values in the store's
// time zone, so they are formatted as-is, without time zone conversion.

export const DELIVERY_PARTNER_NAME = 'Partner Logistics'

export type DeliveryType = 'express' | 'standard' | 'scheduled'

/** Display order: Express first (and selected by default). */
export const DELIVERY_ORDER: DeliveryType[] = ['express', 'standard', 'scheduled']

export interface DeliveryWindow {
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
}

export interface DeliveryOption {
  type: DeliveryType
  title: string
  price: number
  window: DeliveryWindow | null
}

export interface DeliveryDay {
  date: string
  available: boolean
}

export interface DeliverySlot {
  id: string
  startTime: string
  endTime: string
  available: boolean
}

export interface DeliverySelection {
  type: DeliveryType
  /** Only for "scheduled". */
  date?: string
  slot?: DeliverySlot
}

/* -------------------------------- formatting ------------------------------- */

export const parseDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

/** "Today", "Tomorrow" or "Wed, Dec 2". */
export function formatDay(date: string, today: Date = new Date()): string {
  if (date === toKey(today)) return 'Today'
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (date === toKey(tomorrow)) return 'Tomorrow'
  return dayFmt.format(parseDate(date))
}

const splitTime = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return { hour12: h % 12 === 0 ? 12 : h % 12, minutes: m, pm: h >= 12 }
}

/** "16:30" -> "4:30 PM" */
export function formatTime(time: string, withMeridiem = true): string {
  const { hour12, minutes, pm } = splitTime(time)
  const base = `${hour12}:${String(minutes).padStart(2, '0')}`
  return withMeridiem ? `${base} ${pm ? 'PM' : 'AM'}` : base
}

/** "4:30 – 5:00 PM", or "11:00 AM – 1:00 PM" when the meridiem changes. */
export function formatTimeRange(start: string, end: string): string {
  const sameMeridiem = splitTime(start).pm === splitTime(end).pm
  return `${formatTime(start, !sameMeridiem)} – ${formatTime(end)}`
}

export function formatWindow(window: DeliveryWindow, today: Date = new Date()): string {
  if (window.startTime && window.endTime) {
    return `${formatDay(window.startDate, today)}, ${formatTimeRange(window.startTime, window.endTime)}`
  }
  if (window.startDate === window.endDate) return formatDay(window.startDate, today)
  return `${formatDay(window.startDate, today)} – ${formatDay(window.endDate, today)}`
}

export const formatPrice = (value: number) => (value === 0 ? 'Free' : `$${value.toFixed(2)}`)

export function isDeliveryComplete(selection: DeliverySelection): boolean {
  return selection.type !== 'scheduled' || Boolean(selection.date && selection.slot)
}
