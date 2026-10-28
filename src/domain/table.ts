/** Detail-table sorting: header clicks toggle direction; text columns start ascending. */

export type TableKind = "time" | "project" | "model";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export const DEFAULT_SORT: Readonly<Record<TableKind, SortState>> = {
  time: { key: "key", dir: "desc" },
  project: { key: "total", dir: "desc" },
  model: { key: "total", dir: "desc" },
};

const TEXT_KEYS = new Set(["name", "model", "engine"]);

export function nextSort(current: SortState, key: string): SortState {
  if (current.key === key) return { key, dir: current.dir === "desc" ? "asc" : "desc" };
  return { key, dir: TEXT_KEYS.has(key) ? "asc" : "desc" };
}

export function ariaSort(current: SortState, key: string): "ascending" | "descending" | "none" {
  if (current.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/** Stable sort; the time column ("key") sorts by chronological `order`; null/undefined sort last. */
export function sortRows<T extends Record<string, unknown>>(rows: readonly T[], sort: SortState): T[] {
  const field = sort.key === "key" ? "order" : sort.key;
  const dir = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const x = a.row[field];
      const y = b.row[field];
      const xNull = x == null;
      const yNull = y == null;
      if (xNull || yNull) return xNull && yNull ? a.i - b.i : xNull ? 1 : -1;
      const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y);
      return c !== 0 ? c * dir : a.i - b.i;
    })
    .map((e) => e.row);
}
