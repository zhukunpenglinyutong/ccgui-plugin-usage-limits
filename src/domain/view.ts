/**
 * Center-tab view state shared by the popover deep links and the page.
 * Every transition is a pure function returning a new state.
 */
import { addDays, minKey, type DayKey } from "./dates.ts";
import {
  anchorForSwitch,
  shiftAnchor,
  type DateRange,
  type Period,
} from "./periods.ts";
import { DEFAULT_SORT, nextSort, type SortState, type TableKind } from "./table.ts";
import type { Drill } from "./trend.ts";

export type Page = "overview" | "limits";
export type Layer = "range" | "sources" | "bell";

export interface ViewState {
  page: Page;
  period: Period;
  anchor: DayKey;
  range: DateRange | null;
  engine: string | null;
  table: TableKind;
  sort: Record<TableKind, SortState>;
  modelsOpen: boolean;
  drawer: string | null;
  layer: Layer | null;
  popover: boolean;
  /** Bumped to ask the page to scroll the detail table into view. */
  tableFocus: number;
}

export function initialView(today: DayKey): ViewState {
  return {
    page: "overview",
    period: "month",
    anchor: today,
    range: null,
    engine: null,
    table: "time",
    sort: { ...DEFAULT_SORT },
    modelsOpen: false,
    drawer: null,
    layer: null,
    popover: false,
    tableFocus: 0,
  };
}

const closeOverlays = (s: ViewState): ViewState => ({ ...s, layer: null, drawer: null });

export function setPage(s: ViewState, page: Page): ViewState {
  return { ...closeOverlays(s), page };
}

export function setPeriod(s: ViewState, period: Exclude<Period, "custom">, today: DayKey): ViewState {
  return { ...s, period, anchor: anchorForSwitch(s.period, s.anchor, s.range, period, today), range: null, layer: null };
}

export function shift(s: ViewState, dir: number): ViewState {
  return { ...s, anchor: shiftAnchor(s.period, s.anchor, dir) };
}

export function goToday(s: ViewState, today: DayKey): ViewState {
  return { ...s, anchor: today };
}

export function applyRange(s: ViewState, range: DateRange): ViewState {
  return { ...s, period: "custom", range, anchor: range.to, layer: null };
}

/** Engine card / share bar / filter chip: clicking the active engine clears it. */
export function toggleEngine(s: ViewState, id: string | null): ViewState {
  return { ...s, engine: id && s.engine !== id ? id : null };
}

export function drill(s: ViewState, d: Drill, today: DayKey): ViewState {
  if (d.kind === "day") return { ...closeOverlays(s), period: "day", anchor: d.key, range: null };
  if (d.kind === "month") return { ...closeOverlays(s), period: "month", anchor: d.key, range: null };
  return applyRange(closeOverlays(s), { from: d.key, to: minKey(addDays(d.key, 6), today) });
}

/** Popover cards → overview: day = today; 7/30 days are rolling (custom); total = all. */
export function setTable(s: ViewState, table: TableKind, focus = false): ViewState {
  return { ...s, table, tableFocus: focus ? s.tableFocus + 1 : s.tableFocus };
}

export function sortBy(s: ViewState, key: string): ViewState {
  return { ...s, sort: { ...s.sort, [s.table]: nextSort(s.sort[s.table], key) } };
}

export function toggleLayer(s: ViewState, layer: Layer): ViewState {
  return { ...s, layer: s.layer === layer ? null : layer };
}
