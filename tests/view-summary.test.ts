import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../src/domain/view.ts";
import * as S from "../src/domain/summary.ts";
import { periodRange } from "../src/domain/periods.ts";
import { engineDef, engineOrder, ENGINES } from "../src/domain/engines.ts";
import { row } from "./helpers.ts";

const TODAY = "2026-10-27";
const tok = (n: number) => ({ input: n, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 });

test("view transitions are pure and close overlays where the design says so", () => {
  const s0 = V.initialView(TODAY);
  const withLayer = { ...s0, layer: "sources" as const, drawer: "p1" };
  const page = V.setPage(withLayer, "limits");
  assert.deepEqual([page.page, page.layer, page.drawer], ["limits", null, null]);
  assert.equal(withLayer.page, "overview");
  const custom = V.applyRange(s0, { from: "2026-10-01", to: "2026-10-10" });
  assert.deepEqual([custom.period, custom.anchor], ["custom", "2026-10-10"]);
  const week = V.setPeriod(custom, "week", TODAY);
  assert.deepEqual([week.period, week.anchor, week.range], ["week", "2026-10-10", null]);
  assert.equal(V.shift(week, -1).anchor, "2026-10-03");
  assert.equal(V.goToday(week, TODAY).anchor, TODAY);
  assert.equal(V.toggleEngine(s0, "pi").engine, "pi");
  assert.equal(V.toggleEngine(V.toggleEngine(s0, "pi"), "pi").engine, null);
  assert.equal(V.toggleEngine(V.toggleEngine(s0, "pi"), null).engine, null);
  assert.deepEqual(V.drill(withLayer, { kind: "day", key: "2026-10-03" }, TODAY).period, "day");
  assert.equal(V.drill(withLayer, { kind: "day", key: "2026-10-03" }, TODAY).drawer, null);
  assert.deepEqual(V.drill(s0, { kind: "month", key: "2026-09-01" }, TODAY).anchor, "2026-09-01");
  assert.deepEqual(V.drill(s0, { kind: "week", key: "2026-10-26" }, TODAY).range, { from: "2026-10-26", to: TODAY });
  assert.equal(V.toggleLayer(V.toggleLayer(s0, "range"), "range").layer, null);
  const t = V.setTable(s0, "model", true);
  assert.deepEqual([t.table, t.tableFocus], ["model", 1]);
  assert.equal(V.setTable(t, "time").tableFocus, 1);
  const sorted = V.sortBy(t, "model");
  assert.deepEqual(sorted.sort.model, { key: "model", dir: "asc" });
  assert.deepEqual(sorted.sort.time, s0.sort.time);
});

test("popover summary: rolling windows, exclusions, same-time delta", () => {
  const daily = [
    row({ bucket: TODAY, ...tok(300) }),
    row({ bucket: "2026-10-22", ...tok(100) }),
    row({ bucket: "2026-10-01", ...tok(50) }),
    row({ bucket: "2026-09-01", engine: "pi", ...tok(1000) }),
  ];
  const s = S.popoverSummary({
    daily,
    todayHours: [row({ bucket: `${TODAY}T08`, ...tok(300) })],
    yesterdayHours: [row({ bucket: "2026-10-26T08", ...tok(150) })],
    today: TODAY,
    now: new Date(2026, 9, 27, 9, 0),
    excluded: ["pi"],
  });
  assert.equal(s.today.total, 300);
  assert.equal(s.last7.total, 400);
  assert.equal(s.active7, 2);
  assert.equal(s.last30.total, 450);
  assert.equal(s.all.total, 450);
  assert.equal(s.delta, 1);
  assert.equal(s.hours[8], 300);
  assert.equal(s.nowHour, 9);
  assert.equal(S.popoverSummary({ daily, todayHours: [], yesterdayHours: null, today: TODAY, now: new Date(), excluded: [] }).delta, null);
});

test("hero summary: engine filter, to-date comparison, forecast, shares ignore filter", () => {
  const daily = [
    row({ bucket: "2026-10-05", engine: "claude", ...tok(100) }),
    row({ bucket: "2026-10-06", engine: "codex", ...tok(300) }),
    row({ bucket: "2026-09-05", engine: "claude", ...tok(50) }),
    row({ bucket: "2026-09-29", engine: "claude", ...tok(999) }), // after the "to date" cut
  ];
  const pr = periodRange("month", TODAY, null, TODAY, "2026-09-01");
  const all = S.heroSummary({ pr, daily, prevDayHours: null, today: TODAY, now: new Date(2026, 9, 27, 12), engine: null, excluded: [] });
  assert.equal(all.sum.total, 400);
  assert.equal(all.span, 27);
  assert.equal(all.active, 2);
  assert.deepEqual(all.compare, { delta: 7, kind: "monthToDate", span: 31 });
  assert.equal(all.shares.length, 2);
  assert.equal(all.sharesTotal, 400);
  assert.ok(all.forecast && all.forecast > 400);
  const claude = S.heroSummary({ pr, daily, prevDayHours: null, today: TODAY, now: new Date(), engine: "claude", excluded: [] });
  assert.equal(claude.sum.total, 100);
  assert.equal(claude.shares.length, 2);
  assert.equal(claude.compare?.delta, 1);
  const day = periodRange("day", TODAY, null, TODAY, null);
  const dayRows = [row({ bucket: TODAY, ...tok(120) })];
  const pending = S.heroSummary({ pr: day, daily: dayRows, prevDayHours: null, today: TODAY, now: new Date(2026, 9, 27, 10, 30), engine: null, excluded: [] });
  assert.equal(pending.compare, null);
  const same = S.heroSummary({
    pr: day,
    daily: dayRows,
    prevDayHours: [row({ bucket: "2026-10-26T09", ...tok(60) }), row({ bucket: "2026-10-26T10", ...tok(120) })],
    today: TODAY,
    now: new Date(2026, 9, 27, 10, 30),
    engine: null,
    excluded: [],
  });
  assert.deepEqual(same.compare, { delta: 0, kind: "sameTime", span: 1 });
  const custom = periodRange("custom", TODAY, { from: "2026-10-01", to: "2026-10-10" }, TODAY, null);
  assert.equal(S.heroSummary({ pr: custom, daily, prevDayHours: null, today: TODAY, now: new Date(), engine: null, excluded: [] }).compare?.kind, "custom");
  const year = periodRange("year", "2025-05-01", null, TODAY, null);
  assert.equal(S.heroSummary({ pr: year, daily, prevDayHours: null, today: TODAY, now: new Date(), engine: null, excluded: [] }).compare, null);
});

test("lastDays fills 30 days with zeros", () => {
  const days = S.lastDays([row({ bucket: TODAY, ...tok(5) }), row({ bucket: `${TODAY}T03`, ...tok(1) })], TODAY);
  assert.equal(days.length, 30);
  assert.deepEqual(days[29], { key: TODAY, total: 6 });
  assert.equal(days[0].key, "2026-09-28");
});

test("engine registry: known engines, unknown fallback, ordering", () => {
  assert.equal(engineDef("omp").label, "oh-my-pi");
  assert.equal(engineDef("kimi").label, "kimi");
  assert.match(engineDef("kimi").color, /^var\(--color-chart-\d, #[0-9a-f]{6}\)$/);
  assert.equal(engineDef("kimi").color, engineDef("kimi").color);
  assert.deepEqual(["zz", "omp", "aa", "claude"].sort(engineOrder), ["claude", "omp", "aa", "zz"]);
  assert.equal(ENGINES.length, 4);
});
