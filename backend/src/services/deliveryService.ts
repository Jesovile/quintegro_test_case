// Mock of the delivery partner API.
// All dates and times are wall-clock values in the store's time zone:
// dates are "YYYY-MM-DD", times are "HH:mm" (24h).

export type DeliveryType = 'express' | 'standard' | 'scheduled';

export interface DeliveryWindow {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
}

export interface DeliveryOption {
  type: DeliveryType;
  title: string;
  price: number;
  /** Null for "scheduled": the customer picks a day and a slot. */
  window: DeliveryWindow | null;
}

export interface DeliveryDay {
  date: string;
  available: boolean;
}

export interface DeliverySlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export const STORE_TIME_ZONE = 'America/New_York';

const OPEN_MINUTES = 9 * 60; // partner couriers work 09:00–21:00
const CLOSE_MINUTES = 21 * 60;
const EXPRESS_PREP_MINUTES = 60; // time to pack an order before the courier picks it up
const EXPRESS_WINDOW_MINUTES = 30;
const STANDARD_FIRST_DAY = 3; // standard delivery: a 2-day window starting in 3 days
const STANDARD_WINDOW_DAYS = 2;
const SCHEDULE_DAYS_AHEAD = 14;
const SLOT_HOURS = 2;

const PRICES: Record<DeliveryType, number> = { express: 9.99, standard: 0, scheduled: 4.99 };

/* ------------------------------ date helpers ------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Adds days to a "YYYY-MM-DD" string without any time zone drift. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const weekday = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
};

/** Current wall-clock date and minutes since midnight in the store's time zone. */
export function storeNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: STORE_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(p => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Small deterministic hash so mock availability is stable between requests. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/* --------------------------------- service -------------------------------- */

export class DeliveryService {
  constructor(private clock: () => Date = () => new Date()) {}

  getOptions(): DeliveryOption[] {
    const { date: today } = storeNow(this.clock());
    return [
      { type: 'express', title: 'Express', price: PRICES.express, window: this.nextExpressWindow() },
      {
        type: 'standard',
        title: 'Standard',
        price: PRICES.standard,
        window: {
          startDate: addDays(today, STANDARD_FIRST_DAY),
          endDate: addDays(today, STANDARD_FIRST_DAY + STANDARD_WINDOW_DAYS - 1),
        },
      },
      { type: 'scheduled', title: 'Choose a Time Slot', price: PRICES.scheduled, window: null },
    ];
  }

  /** Earliest 30-minute window, rounded up to :00 / :30, within courier hours. */
  nextExpressWindow(): DeliveryWindow {
    const now = storeNow(this.clock());
    let date = now.date;
    let start = Math.ceil((now.minutes + EXPRESS_PREP_MINUTES) / EXPRESS_WINDOW_MINUTES) * EXPRESS_WINDOW_MINUTES;

    if (start < OPEN_MINUTES) start = OPEN_MINUTES;
    if (start + EXPRESS_WINDOW_MINUTES > CLOSE_MINUTES) {
      date = addDays(date, 1);
      start = OPEN_MINUTES;
    }

    return {
      startDate: date,
      endDate: date,
      startTime: toTime(start),
      endTime: toTime(start + EXPRESS_WINDOW_MINUTES),
    };
  }

  /** Days a time slot can be booked: tomorrow + 13 days. No deliveries on Sundays. */
  getDays(): DeliveryDay[] {
    const { date: today } = storeNow(this.clock());
    return Array.from({ length: SCHEDULE_DAYS_AHEAD }, (_, i) => {
      const date = addDays(today, i + 1);
      return { date, available: this.getSlots(date).some(slot => slot.available) };
    });
  }

  /** 2-hour slots 09:00–21:00; some are already booked (deterministic mock). */
  getSlots(date: string): DeliverySlot[] {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date, expected YYYY-MM-DD');
    }

    const { date: today } = storeNow(this.clock());
    const inRange = date > today && date <= addDays(today, SCHEDULE_DAYS_AHEAD);
    if (!inRange || weekday(date) === 0) {
      return [];
    }

    const slots: DeliverySlot[] = [];
    for (let start = OPEN_MINUTES; start + SLOT_HOURS * 60 <= CLOSE_MINUTES; start += SLOT_HOURS * 60) {
      const startTime = toTime(start);
      slots.push({
        id: `${date}T${startTime}`,
        startTime,
        endTime: toTime(start + SLOT_HOURS * 60),
        available: hash(`${date}-${startTime}`) % 3 !== 0,
      });
    }
    return slots;
  }
}
