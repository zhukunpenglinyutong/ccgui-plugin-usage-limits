/**
 * Trend chart buckets. Granularity follows the period: "day" → 24 hours,
 * week / month / short custom → days, long custom → weeks, year / all →
 * months. Future buckets in a period that contains today carry a forecast
 * (recent active-day average) for day granularity only.
 */
import type { UsageStatRow } from "../sdk-usage";
import { sumRows, tokensOf, type Totals } from "./aggregate.ts";
import {
  addDays,
  addMonths,
  endOfMonth,
  maxKey,
  minKey,
  parseBucket,
  startOfMonth,
  type DayKey,
} from "./dates.ts";
import { assignModelColors, engineDef, engineOrder, OTHER_COLOR } from "./engines.ts";
import type { PeriodRange } from "./periods.ts";

export type TrendBy = "engine" | "model";
export const OTHER_KEY = "__other";
export const MAX_MODEL_SERIES = 6;

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

export interface TrendPart extends SeriesDef {
  v: number;
}

export interface Drill {
  kind: "day" | "week" | "month";
  key: DayKey;
}

export interface TrendBucket {
  key: string;
  gran: PeriodRange["gran"];
  from: DayKey;
  to: DayKey;
  hour: number | null;
  total: number;
  sum: Totals;
  parts: TrendPart[];
  future: boolean;
  isNow: boolean;
  drill: Drill | null;
  forecast: number;
}

export function seriesDefs(rows: readonly UsageStatRow[], by: TrendBy, otherLabel: string): SeriesDef[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const k = by === "engine" ? r.engine : r.model;
    totals.set(k, (totals.get(k) ?? 0) + tokensOf(r));
  }
  const present = [...totals.entries()].filter(([, v]) => v > 0);
  if (by === "engine") {
    return present
      .map(([id]) => id)
      .sort(engineOrder)
      .map((id) => ({ key: id, name: engineDef(id).label, color: engineDef(id).color }));
  }
  const ranked = present.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // Colors are assigned over every present model (not just the top 6) so the
  // stack and the ranking list give the same model the same hue.
  const colors = assignModelColors(present.map(([model]) => model));
  const top = ranked
    .slice(0, MAX_MODEL_SERIES)
    .map(([model]) => ({ key: model, name: model, color: colors.get(model) ?? OTHER_COLOR }));
  return ranked.length > MAX_MODEL_SERIES ? [...top, { key: OTHER_KEY, name: otherLabel, color: OTHER_COLOR }] : top;
}

function splitParts(rows: readonly UsageStatRow[], defs: readonly SeriesDef[], by: TrendBy): TrendPart[] {
  const keys = new Set(defs.map((d) => d.key));
  const vals = new Map<string, number>(defs.map((d) => [d.key, 0]));
  for (const r of rows) {
    const raw = by === "engine" ? r.engine : r.model;
    const key = keys.has(raw) ? raw : OTHER_KEY;
    if (vals.has(key)) vals.set(key, (vals.get(key) ?? 0) + tokensOf(r));
  }
  return defs.map((d) => ({ ...d, v: vals.get(d.key) ?? 0 }));
}

function indexByDay(rows: readonly UsageStatRow[]): Map<DayKey, UsageStatRow[]> {
  const map = new Map<DayKey, UsageStatRow[]>();
  for (const r of rows) {
    const day = r.bucket.slice(0, 10);
    const list = map.get(day);
    if (list) list.push(r);
    else map.set(day, [r]);
  }
  return map;
}

function rowsIn(index: Map<DayKey, UsageStatRow[]>, from: DayKey, to: DayKey): UsageStatRow[] {
  const out: UsageStatRow[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = index.get(d);
    if (list) out.push(...list);
  }
  return out;
}

interface RawBucket {
  key: string;
  from: DayKey;
  to: DayKey;
  hour: number | null;
  future: boolean;
  isNow: boolean;
  drill: Drill | null;
}

function rawBuckets(pr: PeriodRange, today: DayKey, nowHour: number): RawBucket[] {
  const out: RawBucket[] = [];
  if (pr.gran === "hour") {
    const isToday = pr.from === today;
    for (let h = 0; h < 24; h += 1) {
      out.push({ key: `h${h}`, from: pr.from, to: pr.from, hour: h, future: isToday && h > nowHour, isNow: isToday && h === nowHour, drill: null });
    }
    return out;
  }
  if (pr.gran === "day") {
    for (let d = pr.from; d <= pr.to; d = addDays(d, 1)) {
      out.push({ key: d, from: d, to: d, hour: null, future: d > today, isNow: d === today, drill: { kind: "day", key: d } });
    }
    return out;
  }
  if (pr.gran === "week") {
    for (let d = pr.from; d <= pr.to; d = addDays(d, 7)) {
      const end = minKey(addDays(d, 6), pr.to);
      out.push({ key: `w${d}`, from: d, to: end, hour: null, future: d > today, isNow: d <= today && today <= end, drill: { kind: "week", key: d } });
    }
    return out;
  }
  for (let m = startOfMonth(pr.from); m <= pr.to; m = addMonths(m, 1)) {
    const end = endOfMonth(m);
    out.push({
      key: `m${m}`,
      from: maxKey(m, pr.from),
      to: minKey(end, pr.to),
      hour: null,
      future: m > today,
      isNow: m <= today && today <= end,
      drill: { kind: "month", key: m },
    });
  }
  return out;
}

export function trendBuckets(opts: {
  pr: PeriodRange;
  today: DayKey;
  nowHour: number;
  /** Day-bucket rows (already filtered by engine / exclusions). */
  daily: readonly UsageStatRow[];
  /** Hour-bucket rows for pr.from when gran = "hour". */
  hourly: readonly UsageStatRow[];
  by: TrendBy;
  otherLabel: string;
  /** Recent daily average; > 0 enables forecasts on future day buckets. */
  avg: number;
}): TrendBucket[] {
  const { pr, today, nowHour, by } = opts;
  const source = pr.gran === "hour" ? opts.hourly : opts.daily;
  const defs = seriesDefs(source, by, opts.otherLabel);
  const byDay = pr.gran === "hour" ? null : indexByDay(opts.daily);
  const byHour = new Map<number, UsageStatRow[]>();
  if (pr.gran === "hour") {
    for (const r of opts.hourly) {
      const { hour } = parseBucket(r.bucket);
      if (hour == null) continue;
      byHour.set(hour, [...(byHour.get(hour) ?? []), r]);
    }
  }
  const forecastOn = pr.gran === "day" && pr.containsToday && opts.avg > 0;
  return rawBuckets(pr, today, nowHour).map((b) => {
    const rows = b.future ? [] : b.hour != null ? (byHour.get(b.hour) ?? []) : rowsIn(byDay as Map<DayKey, UsageStatRow[]>, b.from, b.to);
    const sum = sumRows(rows);
    return {
      ...b,
      gran: pr.gran,
      total: sum.total,
      sum,
      parts: splitParts(rows, defs, by),
      forecast: forecastOn && b.future ? opts.avg : 0,
    };
  });
}

/** Round an axis maximum up to a readable step (1, 1.5, 2, 3, 4, 5, 6, 8, 10 × 10^n). */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((x) => n <= x + 1e-9) ?? 10;
  return step * p;
}
