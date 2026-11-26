import React from 'react'
import { CalendarClock, Truck, Zap } from 'lucide-react'
import { Group, OptionRow, Section } from './GroupedList'
import SchedulePicker from './SchedulePicker'
import { LoadError, SkeletonRows } from './States'
import {
  DELIVERY_ORDER,
  DELIVERY_PARTNER_NAME,
  DeliveryDay,
  DeliveryOption,
  DeliverySelection,
  DeliveryType,
  formatDay,
  formatPrice,
  formatTimeRange,
  formatWindow,
} from '@/lib/delivery'

const ICONS: Record<DeliveryType, { icon: React.ReactNode; className: string }> = {
  express: { icon: <Zap className="h-4 w-4" />, className: 'bg-[#ff3b30]' },
  standard: { icon: <Truck className="h-4 w-4" />, className: 'bg-[#ff9500]' },
  scheduled: { icon: <CalendarClock className="h-4 w-4" />, className: 'bg-[#5856d6]' },
}

interface Props {
  options: DeliveryOption[] | undefined
  days: DeliveryDay[] | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
  value: DeliverySelection
  onChange: (selection: DeliverySelection) => void
  error?: string
}

function subtitleFor(option: DeliveryOption, value: DeliverySelection): string {
  if (option.window) return formatWindow(option.window)
  if (option.type === 'scheduled' && value.type === 'scheduled' && value.date && value.slot) {
    return `${formatDay(value.date)}, ${formatTimeRange(value.slot.startTime, value.slot.endTime)}`
  }
  return 'Pick a day and time that suits you'
}

const DeliverySection: React.FC<Props> = ({ options, days, loading, failed, onRetry, value, onChange, error }) => {
  const sorted = [...(options ?? [])].sort((a, b) => DELIVERY_ORDER.indexOf(a.type) - DELIVERY_ORDER.indexOf(b.type))

  return (
    <Section
      id="checkout-delivery"
      title="Delivery"
      footer={
        error ? (
          <span role="alert" className="text-[#ff3b30]">
            {error}
          </span>
        ) : (
          <>
            Delivered by <span className="font-medium text-gray-900">{DELIVERY_PARTNER_NAME}</span>. You'll get a
            tracking link by SMS and email.
          </>
        )
      }
    >
      <Group>
        {loading && !options && <SkeletonRows count={3} />}
        {failed && !options && <LoadError message="Couldn't load delivery options." onRetry={onRetry} />}
        {sorted.map((option) => (
          <React.Fragment key={option.type}>
            <OptionRow
              name="delivery"
              value={option.type}
              checked={value.type === option.type}
              onSelect={(type) =>
                onChange(type === value.type ? value : { type: type as DeliveryType })
              }
              icon={ICONS[option.type].icon}
              iconClassName={ICONS[option.type].className}
              title={option.title}
              subtitle={subtitleFor(option, value)}
              trailing={formatPrice(option.price)}
            />
            {option.type === 'scheduled' && value.type === 'scheduled' && (
              <SchedulePicker
                days={days ?? []}
                date={value.date}
                slot={value.slot}
                onChange={(date, slot) => onChange({ type: 'scheduled', date, slot })}
              />
            )}
          </React.Fragment>
        ))}
      </Group>
    </Section>
  )
}

export default DeliverySection
