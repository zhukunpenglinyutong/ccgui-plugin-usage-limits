/**
 * Local-calendar date helpers. Day keys are local "YYYY-MM-DD" strings (the
 * host buckets usage by the user's local day); every helper is pure and
 * works on keys or on local-midnight Date objects. Weeks start on Monday.
 */

export type DayKey = string;

const DAY_MS = 86_400_000;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number): string => String(n).padStart(2, "0");

export function keyOf(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false;
  const m = KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return keyOf(d) === value;
}

export function fromKey(key: DayKey): Date {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayKey(now: number): DayKey {
  return keyOf(new Date(now));
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** First day of the month `n` months away from `key`'s month. */
export function addMonths(key: DayKey, n: number): DayKey {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Same day-of-month `n` months away, clamped to the target month's length. */
export function shiftMonthsClamped(key: DayKey, n: number): DayKey {
  const d = fromKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return keyOf(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
}

export function startOfWeek(key: DayKey): DayKey {
  const d = fromKey(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}

export function startOfMonth(key: DayKey): DayKey {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(key: DayKey): DayKey {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function startOfYear(key: DayKey): DayKey {
  return `${key.slice(0, 4)}-01-01`;
}

export function endOfYear(key: DayKey): DayKey {
  return `${key.slice(0, 4)}-12-31`;
}

/** Whole calendar days from `a` to `b` (DST-safe: rounds the ms delta). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / DAY_MS);
}

export const minKey = (a: DayKey, b: DayKey): DayKey => (a < b ? a : b);
export const maxKey = (a: DayKey, b: DayKey): DayKey => (a > b ? a : b);

/** Inclusive list of day keys. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

/** Bucket "2026-10-27T14" → { day, hour }; day-only buckets have hour null. */
export function parseBucket(bucket: string): { day: DayKey; hour: number | null } {
  const [day, hour] = bucket.split("T");
  return { day, hour: hour == null ? null : Number(hour) };
}
