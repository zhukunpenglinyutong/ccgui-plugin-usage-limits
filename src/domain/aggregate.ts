/**
 * Pure aggregation over host usage rows. "Tokens" = input + output + cache
 * read + cache write; reasoning is already inside output and never added.
 * Rows without a price (cost null) contribute 0 to cost and are reported as
 * unknown models instead of being guessed from another model's price.
 */
import type { UsageStatRow } from "../sdk-usage";
import { daysBetween, parseBucket, type DayKey } from "./dates.ts";
import { engineOrder } from "./engines.ts";

export interface Totals {
  total: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  requests: number;
  sessions: number;
  cost: number;
  unknownTokens: number;
  unknownModels: string[];
}

/** Share of prompt tokens served from cache: cacheRead / (input + cacheRead); null when there is nothing to divide. */
export function cacheHitRate(t: Pick<Totals, "input" | "cacheRead">): number | null {
  const prompt = t.input + t.cacheRead;
  return prompt > 0 ? t.cacheRead / prompt : null;
}

export const tokensOf = (r: UsageStatRow): number => r.input + r.output + r.cacheRead + r.cacheWrite;

export function sumRows(rows: readonly UsageStatRow[], factor = 1): Totals {
  // Local accumulators keep this O(n) without per-row allocations; the
  // function stays pure (inputs untouched, a fresh object is returned).
  let total = 0, input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
  let reasoning = 0, requests = 0, sessions = 0, cost = 0, unknownTokens = 0;
  const unknown = new Set<string>();
  for (const r of rows) {
    const tokens = tokensOf(r) * factor;
    total += tokens;
    input += r.input * factor;
    output += r.output * factor;
    cacheRead += r.cacheRead * factor;
    cacheWrite += r.cacheWrite * factor;
    reasoning += r.reasoning * factor;
    requests += r.requests * factor;
    sessions += r.sessions * factor;
    if (r.cost == null) {
      unknownTokens += tokens;
      if (tokens > 0) unknown.add(r.model);
    } else {
      cost += r.cost * factor;
    }
  }
  return {
    total, input, output, cacheRead, cacheWrite, reasoning, requests, sessions, cost, unknownTokens,
    unknownModels: [...unknown].sort(),
  };
}

export interface RowFilter {
  from?: DayKey;
  to?: DayKey;
  engine?: string | null;
  excluded?: readonly string[];
}

/** Works for day and hour buckets (compares the bucket's day part). */
export function filterRows(rows: readonly UsageStatRow[], f: RowFilter): UsageStatRow[] {
  const excluded = f.excluded && f.excluded.length ? new Set(f.excluded) : null;
  return rows.filter((r) => {
    if (excluded && excluded.has(r.engine)) return false;
    if (f.engine && r.engine !== f.engine) return false;
    if (f.from || f.to) {
      const day = r.bucket.length > 10 ? r.bucket.slice(0, 10) : r.bucket;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    return true;
  });
}

export function activeDays(rows: readonly UsageStatRow[]): number {
  const days = new Set<string>();
  for (const r of rows) if (tokensOf(r) > 0) days.add(r.bucket.slice(0, 10));
  return days.size;
}

/** Day key → token total for day-bucket rows. */
export function dailyTotals(rows: readonly UsageStatRow[]): Map<DayKey, number> {
  const map = new Map<DayKey, number>();
  for (const r of rows) map.set(r.bucket, (map.get(r.bucket) ?? 0) + tokensOf(r));
  return map;
}

function groupBy<K>(rows: readonly UsageStatRow[], keyFn: (r: UsageStatRow) => K): Map<K, UsageStatRow[]> {
  const map = new Map<K, UsageStatRow[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

export interface EngineShare {
  id: string;
  total: number;
  share: number;
  models: number;
}

export function engineShares(rows: readonly UsageStatRow[]): EngineShare[] {
  const all = sumRows(rows).total || 1;
  return [...groupBy(rows, (r) => r.engine).entries()]
    .map(([id, rs]) => {
      const total = sumRows(rs).total;
      return { id, total, share: total / all, models: new Set(rs.map((r) => r.model)).size };
    })
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total || engineOrder(a.id, b.id));
}

export interface ModelStat extends Totals {
  model: string;
  /** Engine contributing most tokens to this model. */
  engine: string;
  engines: string[];
  share: number;
  priced: boolean;
}

export function modelRanking(rows: readonly UsageStatRow[]): ModelStat[] {
  const all = sumRows(rows).total || 1;
  return [...groupBy(rows, (r) => r.model).entries()]
    .map(([model, rs]) => {
      const sum = sumRows(rs);
      const byEngine = [...groupBy(rs, (r) => r.engine).entries()]
        .map(([engine, list]) => ({ engine, total: sumRows(list).total }))
        .sort((a, b) => b.total - a.total || engineOrder(a.engine, b.engine));
      return {
        ...sum,
        model,
        engine: byEngine[0]?.engine ?? "",
        engines: byEngine.map((e) => e.engine),
        share: sum.total / all,
        priced: rs.every((r) => r.cost != null),
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));
}

export interface ProjectRef {
  id: string;
  name: string;
  path: string | null;
}

export interface ProjectStat extends Totals, ProjectRef {
  share: number;
  last: DayKey | null;
}

export function projectRanking(
  rows: readonly UsageStatRow[],
  resolve: (cwd: string | null) => ProjectRef,
): ProjectStat[] {
  const all = sumRows(rows).total || 1;
  const refs = new Map<string, ProjectRef>();
  const grouped = groupBy(rows, (r) => {
    const ref = resolve(r.project);
    refs.set(ref.id, ref);
    return ref.id;
  });
  return [...grouped.entries()]
    .map(([id, rs]) => {
      const sum = sumRows(rs);
      const last = rs.reduce<DayKey | null>((m, r) => {
        const day = r.bucket.slice(0, 10);
        return tokensOf(r) > 0 && (!m || day > m) ? day : m;
      }, null);
      const ref = refs.get(id) as ProjectRef;
      return { ...sum, ...ref, share: sum.total / all, last };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Mean of the last `n` days with usage strictly before `today` (0 if none). */
export function recentDailyAvg(dailyRows: readonly UsageStatRow[], today: DayKey, n = 7): number {
  const totals = dailyTotals(dailyRows);
  const days = [...totals.entries()]
    .filter(([day, v]) => day < today && v > 0)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, n);
  return days.length ? days.reduce((acc, [, v]) => acc + v, 0) / days.length : 0;
}

/** Hour-bucket rows → 24 token totals. */
export function hourlyTotals(hourRows: readonly UsageStatRow[]): number[] {
  const out = new Array<number>(24).fill(0);
  for (const r of hourRows) {
    const { hour } = parseBucket(r.bucket);
    if (hour != null && hour >= 0 && hour < 24) out[hour] += tokensOf(r);
  }
  return out;
}

/** Tokens up to the same time of day: hours before `hour` plus the elapsed fraction of `hour`. */
export function sameTimeTotal(hours: readonly number[], hour: number, minuteFraction: number): number {
  let acc = 0;
  for (let h = 0; h < hour; h += 1) acc += hours[h] ?? 0;
  return acc + (hours[hour] ?? 0) * Math.min(Math.max(minuteFraction, 0), 1);
}

/** Relative change; null when there is no baseline to compare against. */
export function delta(current: number, previous: number): number | null {
  return previous > 0 ? current / previous - 1 : null;
}

/** "Today until now" vs "yesterday until the same time". */
export function todayVsYesterday(
  todayHours: readonly UsageStatRow[],
  yesterdayHours: readonly UsageStatRow[],
  now: Date,
): number | null {
  const today = sumRows(todayHours).total;
  const prev = sameTimeTotal(hourlyTotals(yesterdayHours), now.getHours(), now.getMinutes() / 60);
  return delta(today, prev);
}

/** Period-to-date total + remaining future days × recent daily average. */
export function forecastTotal(opts: {
  periodTotal: number;
  to: DayKey;
  today: DayKey;
  avg: number;
}): number | null {
  if (opts.avg <= 0 || opts.to <= opts.today) return null;
  return opts.periodTotal + daysBetween(opts.today, opts.to) * opts.avg;
}
