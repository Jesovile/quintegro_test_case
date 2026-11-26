// Calendar of bookable days + free time slots for the chosen day.
import React from 'react'
import { useQuery } from '@apollo/client'
import { Loader2 } from 'lucide-react'
import { GET_DELIVERY_SLOTS } from '@/graphql/queries'
import { DeliveryDay, DeliverySlot, formatTimeRange, parseDate } from '@/lib/delivery'
import { cn } from '@/lib/utils'
import { LoadError } from './States'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const longFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

interface Props {
  days: DeliveryDay[]
  date?: string
  slot?: DeliverySlot
  onChange: (date: string, slot?: DeliverySlot) => void
}

const SchedulePicker: React.FC<Props> = ({ days, date, slot, onChange }) => {
  const { data, loading, error, refetch } = useQuery<{ deliverySlots: DeliverySlot[] }>(GET_DELIVERY_SLOTS, {
    variables: { date },
    skip: !date,
    notifyOnNetworkStatusChange: true,
  })

  if (days.length === 0) return null

  const first = parseDate(days[0].date)
  const last = parseDate(days[days.length - 1].date)
  const title =
    first.getMonth() === last.getMonth()
      ? monthFmt.format(first)
      : `${first.toLocaleString('en-US', { month: 'long' })} – ${monthFmt.format(last)}`
  const leadingBlanks = first.getDay()
  // Booked slots are not shown at all: the customer only sees what they can pick.
  const slots = (data?.deliverySlots ?? []).filter((s) => s.available)

  return (
    <div className="border-t border-black/10 bg-gray-50/60 px-4 pb-4 pt-3">
      <div className="mb-2 text-[13px] font-semibold text-gray-900">{title}</div>

      <div role="group" aria-label="Delivery day" className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-[11px] font-medium text-gray-400">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const d = parseDate(day.date)
          const selected = day.date === date
          return (
            <button
              key={day.date}
              type="button"
              disabled={!day.available}
              aria-pressed={selected}
              aria-label={`${longFmt.format(d)}${day.available ? '' : ', unavailable'}`}
              onClick={() => onChange(day.date, undefined)}
              className={cn(
                'mx-auto grid h-9 w-9 place-items-center rounded-full text-[15px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]/50',
                selected
                  ? 'bg-[#007aff] font-semibold text-white'
                  : day.available
                    ? 'text-gray-900 hover:bg-[#007aff]/10'
                    : 'cursor-not-allowed text-gray-300 line-through',
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {date && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] font-semibold text-gray-900">{longFmt.format(parseDate(date))}</div>
          {loading && (
            <div className="flex items-center gap-2 py-2 text-[13px] text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading time slots…
            </div>
          )}
          {!loading && error && (
            <LoadError
              message="Couldn't load time slots."
              onRetry={() => refetch()}
              className="rounded-lg bg-white px-3"
            />
          )}
          {!loading && !error && slots.length > 0 && (
            <div role="group" aria-label="Delivery time" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {slots.map((s) => {
                const selected = slot?.id === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(date, s)}
                    className={cn(
                      'h-10 rounded-lg border text-[13px] font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]/50',
                      selected
                        ? 'border-[#007aff] bg-[#007aff] text-white'
                        : 'border-black/10 bg-white text-gray-900 hover:border-[#007aff]',
                    )}
                  >
                    {formatTimeRange(s.startTime, s.endTime)}
                  </button>
                )
              })}
            </div>
          )}
          {!loading && !error && slots.length === 0 && (
            <p className="py-2 text-[13px] text-gray-500">No time slots left on this day.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default SchedulePicker
