/**
 * Data-driven engine registry. Adding an engine the host starts reporting is a
 * one-line entry here; unknown engines still render (label = id, a spare
 * chart color picked deterministically) so new host data never breaks the UI.
 * Colors are host chart tokens (--color-chart-1..8) with light fallbacks.
 */

export interface EngineDef {
  id: string;
  label: string;
  color: string;
  /** Typical session directory, shown in the empty state before sources load. */
  dir: string;
}

export const ENGINES: readonly EngineDef[] = [
  { id: "claude", label: "Claude Code", color: "var(--color-chart-8, #fdc700)", dir: "~/.claude/projects" },
  { id: "codex", label: "Codex", color: "var(--color-chart-4, #00bcff)", dir: "~/.codex/sessions" },
  { id: "pi", label: "Pi", color: "var(--color-chart-6, #51a2ff)", dir: "~/.pi/agent/sessions" },
  { id: "omp", label: "oh-my-pi", color: "var(--color-chart-2, #9ae600)", dir: "~/.omp/agent/sessions" },
];

const SPARE_COLORS = [
  "var(--color-chart-1, #00d5be)",
  "var(--color-chart-5, #c27aff)",
  "var(--color-chart-3, #fb64b6)",
  "var(--color-chart-7, #00d492)",
];

/**
 * Series palette for model series, ported from the reference project
 * (TokenTracker, MIT: TrendMonitor's STACK_COLORS). Twelve hues, so a busy
 * ranking can still give every model its own color.
 */
export const MODEL_COLORS = [
  "var(--color-chart-3, #fb64b6)",
  "var(--color-chart-6, #51a2ff)",
  "var(--color-chart-7, #00d492)",
  "var(--color-chart-8, #fdc700)",
  "var(--color-chart-5, #c27aff)",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
];
export const OTHER_COLOR = "var(--color-chart-neutral, #d4d4d4)";

/** Constant-space hash (FNV-1a) — stable across processes for the same string. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * One stable color per model name: the hash picks a palette slot, then a
 * linear probe keeps the models of a list distinguishable. Names are visited
 * in hash order, so the result does not depend on how the caller sorts them —
 * `deepseek-v4-flash` keeps its color when the ranking order or the period changes.
 */
export function assignModelColors(models: readonly string[]): Map<string, string> {
  const byHash = [...new Set(models)].sort((a, b) => hashString(a) - hashString(b) || a.localeCompare(b));
  const taken = new Set<number>();
  const out = new Map<string, string>();
  for (const model of byHash) {
    let slot = hashString(model) % MODEL_COLORS.length;
    for (let step = 0; step < MODEL_COLORS.length && taken.has(slot); step += 1) {
      slot = (slot + 1) % MODEL_COLORS.length;
    }
    taken.add(slot);
    out.set(model, MODEL_COLORS[slot]);
  }
  return out;
}

const BY_ID = new Map(ENGINES.map((e) => [e.id, e]));

export function engineDef(id: string): EngineDef {
  const known = BY_ID.get(id);
  if (known) return known;
  return { id, label: id, color: SPARE_COLORS[hashString(id) % SPARE_COLORS.length], dir: "" };
}

/** Registry order first, then unknown engines alphabetically. */
export function engineOrder(a: string, b: string): number {
  const ia = ENGINES.findIndex((e) => e.id === a);
  const ib = ENGINES.findIndex((e) => e.id === b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
}
