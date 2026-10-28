/**
 * Dashboard periods: day / week (Mon–Sun) / month / year / all / custom.
 * A PeriodRange is always an inclusive [from, to] pair of local day keys;
 * `to` may lie in the future for periods containing today.
 */
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  endOfYear,
  fromKey,
  minKey,
  shiftMonthsClamped,
  startOfMonth,
  startOfWeek,
  startOfYear,
  type DayKey,
} from "./dates.ts";

export type Period = "day" | "week" | "month" | "year" | "all" | "custom";
export type Granularity = "hour" | "day" | "week" | "month";
export type DateRange = { from: DayKey; to: DayKey };

export interface PeriodRange {
  period: Period;
  from: DayKey;
  to: DayKey;
  gran: Granularity;
  containsToday: boolean;
}

export const PERIODS: Period[] = ["day", "week", "month", "year", "all", "custom"];
export const MAX_CUSTOM_DAYS = 366;
/** Custom ranges longer than this switch the trend to weekly buckets. */
export const WEEKLY_TREND_AFTER_DAYS = 62;

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as string[]).includes(value);
}

export function periodRange(
  period: Period,
  anchor: DayKey,
  range: DateRange | null,
  today: DayKey,
  firstDay: DayKey | null,
): PeriodRange {
  const make = (from: DayKey, to: DayKey, gran: Granularity): PeriodRange => ({
    period,
    from,
    to,
    gran,
    containsToday: from <= today && today <= to,
  });
  switch (period) {
    case "day":
      return make(anchor, anchor, "hour");
    case "week": {
      const from = startOfWeek(anchor);
      return make(from, addDays(from, 6), "day");
    }
    case "month":
      return make(startOfMonth(anchor), endOfMonth(anchor), "day");
    case "year":
      return make(startOfYear(anchor), endOfYear(anchor), "month");
    case "custom": {
      const r = range ?? { from: addDays(today, -29), to: today };
      const days = daysBetween(r.from, r.to) + 1;
      return make(r.from, r.to, days > WEEKLY_TREND_AFTER_DAYS ? "week" : "day");
    }
    default:
      return make(minKey(firstDay ?? today, today), today, "month");
  }
}

export function shiftAnchor(period: Period, anchor: DayKey, dir: number): DayKey {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, dir * 7);
  if (period === "month") return shiftMonthsClamped(anchor, dir);
  if (period === "year") return shiftMonthsClamped(anchor, dir * 12);
  return anchor;
}

/** ‹ › availability: forward stops at the period containing today, back stops before first use. */
export function canShift(
  period: Period,
  anchor: DayKey,
  dir: number,
  today: DayKey,
  firstDay: DayKey | null,
): boolean {
  if (period === "all" || period === "custom") return false;
  const next = periodRange(period, shiftAnchor(period, anchor, dir), null, today, firstDay);
  if (dir > 0) return next.from <= today;
  return next.to >= (firstDay ?? today);
}

/** Last day that can carry data (periods never count the future). */
export const elapsedEnd = (pr: PeriodRange, today: DayKey): DayKey => minKey(pr.to, today);

export interface ComparisonRange {
  from: DayKey;
  to: DayKey;
  /** "sameTime" (day containing today), "toDate" (current period to date) or "full". */
  mode: "sameTime" | "toDate" | "full";
  span: number;
}

/**
 * The previous period of the same length. A current period only compares up
 * to the same point ("同期"): same number of elapsed days, and for "day" the
 * same time of day (the hour fraction is applied by the aggregation layer).
 * The previous range is clamped so it never spills into the current one.
 */
export function previousRange(pr: PeriodRange, today: DayKey): ComparisonRange | null {
  if (pr.period === "all") return null;
  if (pr.period === "day") {
    const d = addDays(pr.from, -1);
    return { from: d, to: d, mode: pr.containsToday ? "sameTime" : "full", span: 1 };
  }
  const span = daysBetween(pr.from, pr.to) + 1;
  const elapsed = daysBetween(pr.from, elapsedEnd(pr, today)) + 1;
  let prevFrom: DayKey;
  if (pr.period === "month") prevFrom = addMonths(pr.from, -1);
  else if (pr.period === "year") prevFrom = `${Number(pr.from.slice(0, 4)) - 1}-01-01`;
  else prevFrom = addDays(pr.from, -span);
  const prevTo = minKey(addDays(prevFrom, elapsed - 1), addDays(pr.from, -1));
  return { from: prevFrom, to: prevTo, mode: pr.containsToday ? "toDate" : "full", span };
}

/** Anchor to keep when switching periods (custom → its end date). */
export function anchorForSwitch(
  current: Period,
  anchor: DayKey,
  range: DateRange | null,
  next: Period,
  today: DayKey,
): DayKey {
  if (next === "all") return today;
  if (current === "custom" && range) return range.to;
  return anchor;
}

export type RangeCheck =
  | { ok: true; days: number }
  | { ok: false; reason: "incomplete" | "future" | "tooLong"; days: number };

export function validateCustomRange(
  draft: { from: DayKey | null; to: DayKey | null },
  today: DayKey,
): RangeCheck {
  if (!draft.from || !draft.to) return { ok: false, reason: "incomplete", days: 0 };
  const days = daysBetween(draft.from, draft.to) + 1;
  if (draft.to > today) return { ok: false, reason: "future", days };
  if (days > MAX_CUSTOM_DAYS) return { ok: false, reason: "tooLong", days };
  return { ok: true, days };
}

/** Two-click calendar selection: first click = start, second = end (earlier restarts). */
export function pickDraftDay(
  draft: { from: DayKey | null; to: DayKey | null },
  key: DayKey,
): { from: DayKey; to: DayKey | null } {
  if (!draft.from || draft.to || key < draft.from) return { from: key, to: null };
  return { from: draft.from, to: key };
}

export type RangePreset = "7" | "30" | "90" | "ytd";

export function presetRange(preset: RangePreset, today: DayKey): DateRange {
  if (preset === "ytd") return { from: startOfYear(today), to: today };
  return { from: addDays(today, -(Number(preset) - 1)), to: today };
}

/** Rolling windows used by the popover cards (“近 7 / 30 天”). */
export function rollingRange(days: number, today: DayKey): DateRange {
  return { from: addDays(today, -(days - 1)), to: today };
}

/** Calendar grid for one month: leading blanks (Mon-start) + day keys. */
export function monthGrid(monthKey: DayKey): { lead: number; days: DayKey[] } {
  const first = startOfMonth(monthKey);
  const lead = (fromKey(first).getDay() + 6) % 7;
  const days: DayKey[] = [];
  for (let k = first, last = endOfMonth(first); k <= last; k = addDays(k, 1)) days.push(k);
  return { lead, days };
}
