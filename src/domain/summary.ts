/**
 * View-model builders for the popover and the overview hero. Pure: they
 * take host rows + view state and return plain numbers for the UI.
 */
import type { UsageStatRow } from "../sdk-usage";
import {
  activeDays,
  delta,
  engineShares,
  filterRows,
  forecastTotal,
  hourlyTotals,
  recentDailyAvg,
  sameTimeTotal,
  sumRows,
  todayVsYesterday,
  tokensOf,
  type EngineShare,
  type Totals,
} from "./aggregate.ts";
import { addDays, daysBetween, type DayKey } from "./dates.ts";
import { elapsedEnd, previousRange, rollingRange, type PeriodRange } from "./periods.ts";

export interface PopoverSummary {
  today: Totals;
  delta: number | null;
  hours: number[];
  nowHour: number;
  last7: Totals;
  active7: number;
  last30: Totals;
  all: Totals;
}

export function popoverSummary(input: {
  daily: readonly UsageStatRow[];
  todayHours: readonly UsageStatRow[];
  yesterdayHours: readonly UsageStatRow[] | null;
  today: DayKey;
  now: Date;
  excluded: readonly string[];
}): PopoverSummary {
  const ex = { excluded: input.excluded };
  const daily = filterRows(input.daily, ex);
  const todayHours = filterRows(input.todayHours, ex);
  const r7 = rollingRange(7, input.today);
  const r30 = rollingRange(30, input.today);
  const rows7 = filterRows(daily, r7);
  return {
    today: sumRows(filterRows(daily, { from: input.today, to: input.today })),
    delta: input.yesterdayHours ? todayVsYesterday(todayHours, filterRows(input.yesterdayHours, ex), input.now) : null,
    hours: hourlyTotals(todayHours),
    nowHour: input.now.getHours(),
    last7: sumRows(rows7),
    active7: activeDays(rows7),
    last30: sumRows(filterRows(daily, r30)),
    all: sumRows(daily),
  };
}

export type CompareKind =
  | "sameTime"
  | "prevDay"
  | "week"
  | "weekToDate"
  | "month"
  | "monthToDate"
  | "year"
  | "yearToDate"
  | "custom";

export interface Comparison {
  delta: number;
  kind: CompareKind;
  span: number;
}

export interface HeroSummary {
  rows: UsageStatRow[];
  sum: Totals;
  span: number;
  active: number;
  forecast: number | null;
  compare: Comparison | null;
  /** Engine shares ignore the engine filter (the cards are the filter). */
  shares: EngineShare[];
  sharesTotal: number;
  modelCount: number;
}

function compareKind(pr: PeriodRange, mode: "sameTime" | "toDate" | "full"): CompareKind {
  if (pr.period === "day") return mode === "sameTime" ? "sameTime" : "prevDay";
  if (pr.period === "custom") return "custom";
  const base = pr.period as "week" | "month" | "year";
  return mode === "toDate" ? (`${base}ToDate` as CompareKind) : base;
}

export function heroSummary(input: {
  pr: PeriodRange;
  daily: readonly UsageStatRow[];
  /** Hour rows of the day before pr.from; needed only for "day" containing today. */
  prevDayHours: readonly UsageStatRow[] | null;
  today: DayKey;
  now: Date;
  engine: string | null;
  excluded: readonly string[];
}): HeroSummary {
  const { pr, today } = input;
  const end = elapsedEnd(pr, today);
  const base = filterRows(input.daily, { excluded: input.excluded });
  const inPeriod = filterRows(base, { from: pr.from, to: end });
  const rows = input.engine ? filterRows(inPeriod, { engine: input.engine }) : inPeriod;
  const engineRows = input.engine ? filterRows(base, { engine: input.engine }) : base;
  const sum = sumRows(rows);
  const span = Math.max(0, daysBetween(pr.from, end) + 1);

  let compare: Comparison | null = null;
  const prev = previousRange(pr, today);
  if (prev) {
    let previous: number | null;
    if (prev.mode === "sameTime") {
      const hours = input.prevDayHours ? filterRows(input.prevDayHours, { excluded: input.excluded, engine: input.engine }) : null;
      previous = hours ? sameTimeTotal(hourlyTotals(hours), input.now.getHours(), input.now.getMinutes() / 60) : null;
    } else {
      previous = sumRows(filterRows(engineRows, { from: prev.from, to: prev.to })).total;
    }
    const d = previous == null ? null : delta(sum.total, previous);
    compare = d == null ? null : { delta: d, kind: compareKind(pr, prev.mode), span: prev.span };
  }

  const forecast =
    pr.gran === "day" && pr.containsToday
      ? forecastTotal({ periodTotal: sum.total, to: pr.to, today, avg: recentDailyAvg(engineRows, today) })
      : null;

  const shares = engineShares(inPeriod);
  return {
    rows,
    sum,
    span,
    active: activeDays(rows),
    forecast,
    compare,
    shares,
    sharesTotal: shares.reduce((acc, s) => acc + s.total, 0),
    modelCount: new Set(inPeriod.map((r) => r.model)).size,
  };
}

/** Last 30 days of a project's daily totals (drawer mini chart). */
export function lastDays(rows: readonly UsageStatRow[], today: DayKey, n = 30): { key: DayKey; total: number }[] {
  const totals = new Map<DayKey, number>();
  for (const r of rows) {
    const day = r.bucket.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + tokensOf(r));
  }
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(today, i - (n - 1));
    return { key, total: totals.get(key) ?? 0 };
  });
}
