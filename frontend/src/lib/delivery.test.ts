import { describe, expect, it } from 'vitest'
import { formatDay, formatPrice, formatTime, formatTimeRange, formatWindow, isDeliveryComplete } from './delivery'

const today = new Date(2026, 10, 26) // Thu, Nov 26, 2026

describe('delivery formatting', () => {
  it('labels today and tomorrow', () => {
    expect(formatDay('2026-11-26', today)).toBe('Today')
    expect(formatDay('2026-11-27', today)).toBe('Tomorrow')
    expect(formatDay('2026-12-02', today)).toBe('Wed, Dec 2')
  })

  it('formats 24h times for US customers', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('12:30')).toBe('12:30 PM')
    expect(formatTime('00:00')).toBe('12:00 AM')
    expect(formatTime('16:30')).toBe('4:30 PM')
  })

  it('shows the meridiem once when it does not change', () => {
    expect(formatTimeRange('16:30', '17:00')).toBe('4:30 – 5:00 PM')
    expect(formatTimeRange('11:00', '13:00')).toBe('11:00 AM – 1:00 PM')
  })

  it('formats the 30-minute express window', () => {
    expect(
      formatWindow({ startDate: '2026-11-26', endDate: '2026-11-26', startTime: '15:30', endTime: '16:00' }, today),
    ).toBe('Today, 3:30 – 4:00 PM')
  })

  it('formats the 2-day standard window', () => {
    expect(formatWindow({ startDate: '2026-11-29', endDate: '2026-11-30' }, today)).toBe('Sun, Nov 29 – Mon, Nov 30')
  })

  it('formats prices', () => {
    expect(formatPrice(0)).toBe('Free')
    expect(formatPrice(9.99)).toBe('$9.99')
  })

  it('requires a day and a slot only for scheduled delivery', () => {
    expect(isDeliveryComplete({ type: 'express' })).toBe(true)
    expect(isDeliveryComplete({ type: 'scheduled', date: '2026-11-28' })).toBe(false)
    expect(
      isDeliveryComplete({
        type: 'scheduled',
        date: '2026-11-28',
        slot: { id: 's', startTime: '09:00', endTime: '11:00', available: true },
      }),
    ).toBe(true)
  })
})
