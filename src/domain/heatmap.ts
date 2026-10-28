/**
 * 26-week contribution heatmap (Mon-start columns). Five levels: 0 = no
 * usage; 1–4 split by the quartiles of the days that do have usage
 * (rank-based), so one extreme day cannot push every other cell into the dark.
 */
import type { UsageStatRow } from "../sdk-usage";
import { dailyTotals } from "./aggregate.ts";
import { addDays, startOfWeek, type DayKey } from "./dates.ts";

export const HEATMAP_WEEKS = 26;

export interface HeatCell {
  key: DayKey;
  total: number;
  cost: number;
  future: boolean;
  level: 0 | 1 | 2 | 3 | 4;
}

/** Quartile cut points over positive values (lower rank, ascending). */
export function quantileCuts(values: readonly number[], qs: readonly number[] = [0.25, 0.5, 0.75]): number[] {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return qs.map(() => 0);
  return qs.map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
}

/** 0 for idle days, otherwise 1 + the number of cuts exceeded, capped at 4. */
export function levelOf(total: number, cuts: readonly number[]): HeatCell["level"] {
  if (!(total > 0)) return 0;
  return Math.min(4, 1 + cuts.filter((c) => total > c).length) as HeatCell["level"];
}

export function heatCells(dailyRows: readonly UsageStatRow[], today: DayKey, weeks = HEATMAP_WEEKS): HeatCell[] {
  const end = addDays(startOfWeek(today), 6);
  const start = addDays(end, -(weeks * 7) + 1);
  const totals = dailyTotals(dailyRows);
  const costs = new Map<DayKey, number>();
  for (const r of dailyRows) if (r.cost != null) costs.set(r.bucket, (costs.get(r.bucket) ?? 0) + r.cost);
  const raw: Omit<HeatCell, "level">[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const future = d > today;
    raw.push({ key: d, total: future ? 0 : (totals.get(d) ?? 0), cost: future ? 0 : (costs.get(d) ?? 0), future });
  }
  const cuts = quantileCuts(raw.map((c) => c.total));
  return raw.map((c) => ({ ...c, level: levelOf(c.total, cuts) }));
}
