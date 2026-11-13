// Business info shared by the app and the dashboard: opening hours per weekday (Friday included), a tappable
// phone number and a navigation link. No imports. Same rules as valid_weekly_hours() in SQL.

/** One day: open and close as "HH:MM" (close may be "24:00"), or null when closed. */
export type DayHours = { open: string; close: string } | null;
/** Seven days, Sunday first (index 0 = ראשון, 5 = שישי, 6 = שבת). */
export type WeeklyHours = DayHours[];

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** The stored value when it is a valid week, else null (the app then hides the hours). */
export function parseWeeklyHours(value: unknown): WeeklyHours | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  const week: WeeklyHours = [];
  for (const d of value) {
    if (d === null) week.push(null);
    else if (d && typeof d === 'object' && TIME.test((d as { open?: string }).open ?? '') && TIME.test((d as { close?: string }).close ?? '')) {
      week.push({ open: (d as { open: string }).open, close: (d as { close: string }).close });
    } else return null;
  }
  return week;
}

/** A week with no open day says nothing: treated as no hours. */
export function hasHours(week: WeeklyHours | null): week is WeeklyHours {
  return !!week && week.some((d) => d !== null);
}

const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The weekday in Israel, 0 = Sunday, whatever the phone's time zone. */
export function israelWeekday(now: Date): number {
  return WEEKDAYS.indexOf(weekdayFmt.format(now));
}

export function dayText(d: DayHours): string {
  return d ? `${d.open}-${d.close}` : 'סגור';
}

/** "היום, שישי: 07:00-14:00" or "היום, שבת: סגור". */
export function todayLine(week: WeeklyHours, now: Date): string {
  const i = israelWeekday(now);
  return `היום, ${DAY_NAMES[i]}: ${dayText(week[i])}`;
}

/** All seven days for the full list, with today marked. */
export function weekLines(week: WeeklyHours, now: Date): { day: string; text: string; today: boolean }[] {
  const today = israelWeekday(now);
  return week.map((d, i) => ({ day: DAY_NAMES[i], text: dayText(d), today: i === today }));
}

/** An Israeli phone number (mobile or landline) as a tel: link, or null when it is not one. */
export function telLink(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  if (!/^0\d{8,9}$/.test(digits)) return null;
  return `tel:+972${digits.slice(1)}`;
}

/** Directions in the phone's maps app (Google Maps opens Waze or Maps as the user prefers on Android). */
export function navigationUrl(b: { address: string | null; lat: number | null; lng: number | null }): string | null {
  if (b.lat !== null && b.lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  if (b.address?.trim()) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address.trim())}`;
  return null;
}

/** Kashrut as the owner wrote it, at most 80 characters; empty means not shown. */
export const KASHRUT_MAX = 80;
