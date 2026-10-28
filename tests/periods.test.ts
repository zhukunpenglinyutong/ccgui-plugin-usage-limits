import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/domain/periods.ts";

const TODAY = "2026-10-27"; // Tuesday
const FIRST = "2026-05-11";

test("period ranges per granularity (week starts Monday)", () => {
  assert.deepEqual(P.periodRange("day", TODAY, null, TODAY, FIRST), { period: "day", from: TODAY, to: TODAY, gran: "hour", containsToday: true });
  const wk = P.periodRange("week", TODAY, null, TODAY, FIRST);
  assert.equal(wk.from, "2026-10-26");
  assert.equal(wk.to, "2026-11-01");
  assert.equal(wk.gran, "day");
  const mo = P.periodRange("month", "2026-09-10", null, TODAY, FIRST);
  assert.deepEqual([mo.from, mo.to, mo.containsToday], ["2026-09-01", "2026-09-30", false]);
  const yr = P.periodRange("year", TODAY, null, TODAY, FIRST);
  assert.deepEqual([yr.from, yr.to, yr.gran], ["2026-01-01", "2026-12-31", "month"]);
  const all = P.periodRange("all", TODAY, null, TODAY, FIRST);
  assert.deepEqual([all.from, all.to, all.gran], [FIRST, TODAY, "month"]);
  assert.equal(P.periodRange("all", TODAY, null, TODAY, null).from, TODAY);
});

test("custom ranges switch to weekly buckets after 62 days", () => {
  const short = P.periodRange("custom", TODAY, { from: "2026-09-01", to: "2026-10-27" }, TODAY, FIRST);
  assert.equal(short.gran, "day");
  const long = P.periodRange("custom", TODAY, { from: "2026-07-01", to: "2026-10-27" }, TODAY, FIRST);
  assert.equal(long.gran, "week");
  const fallback = P.periodRange("custom", TODAY, null, TODAY, FIRST);
  assert.deepEqual([fallback.from, fallback.to], ["2026-09-28", TODAY]);
});

test("navigation: forward stops at the current period, back stops before first use", () => {
  assert.equal(P.canShift("month", TODAY, 1, TODAY, FIRST), false);
  assert.equal(P.canShift("month", TODAY, -1, TODAY, FIRST), true);
  assert.equal(P.canShift("month", "2026-05-20", -1, TODAY, FIRST), false);
  assert.equal(P.canShift("day", "2026-10-26", 1, TODAY, FIRST), true);
  assert.equal(P.canShift("week", TODAY, 1, TODAY, FIRST), false);
  assert.equal(P.canShift("all", TODAY, -1, TODAY, FIRST), false);
  assert.equal(P.canShift("custom", TODAY, 1, TODAY, FIRST), false);
  assert.equal(P.shiftAnchor("week", TODAY, -1), "2026-10-20");
  assert.equal(P.shiftAnchor("month", "2026-03-31", -1), "2026-02-28");
  assert.equal(P.shiftAnchor("year", "2028-02-29", 1), "2029-02-28");
  assert.equal(P.shiftAnchor("custom", TODAY, 1), TODAY);
});

test("previous-period comparison only covers the same elapsed span", () => {
  const mo = P.periodRange("month", TODAY, null, TODAY, FIRST);
  assert.deepEqual(P.previousRange(mo, TODAY), { from: "2026-09-01", to: "2026-09-27", mode: "toDate", span: 31 });
  // A finished 31-day month compares to the whole previous month, never spilling into the current one.
  const oct = P.periodRange("month", "2026-10-05", null, "2026-11-10", FIRST);
  assert.deepEqual(P.previousRange(oct, "2026-11-10"), { from: "2026-09-01", to: "2026-09-30", mode: "full", span: 31 });
  const wk = P.periodRange("week", TODAY, null, TODAY, FIRST);
  assert.deepEqual(P.previousRange(wk, TODAY), { from: "2026-10-19", to: "2026-10-20", mode: "toDate", span: 7 });
  const yr = P.periodRange("year", TODAY, null, TODAY, FIRST);
  assert.equal(P.previousRange(yr, TODAY)?.from, "2025-01-01");
  assert.equal(P.previousRange(yr, TODAY)?.to, "2025-10-27");
  const day = P.periodRange("day", TODAY, null, TODAY, FIRST);
  assert.deepEqual(P.previousRange(day, TODAY), { from: "2026-10-26", to: "2026-10-26", mode: "sameTime", span: 1 });
  const pastDay = P.periodRange("day", "2026-10-20", null, TODAY, FIRST);
  assert.equal(P.previousRange(pastDay, TODAY)?.mode, "full");
  const custom = P.periodRange("custom", TODAY, { from: "2026-10-01", to: "2026-10-10" }, TODAY, FIRST);
  assert.deepEqual(P.previousRange(custom, TODAY), { from: "2026-09-21", to: "2026-09-30", mode: "full", span: 10 });
  assert.equal(P.previousRange(P.periodRange("all", TODAY, null, TODAY, FIRST), TODAY), null);
});

test("anchor survives period switches", () => {
  assert.equal(P.anchorForSwitch("custom", TODAY, { from: "2026-08-01", to: "2026-08-20" }, "month", TODAY), "2026-08-20");
  assert.equal(P.anchorForSwitch("day", "2026-09-03", null, "week", TODAY), "2026-09-03");
  assert.equal(P.anchorForSwitch("day", "2026-09-03", null, "all", TODAY), TODAY);
});

test("custom range validation and two-click picking", () => {
  assert.deepEqual(P.validateCustomRange({ from: "2026-10-01", to: null }, TODAY), { ok: false, reason: "incomplete", days: 0 });
  assert.deepEqual(P.validateCustomRange({ from: "2026-10-01", to: "2026-10-28" }, TODAY), { ok: false, reason: "future", days: 28 });
  assert.deepEqual(P.validateCustomRange({ from: "2025-01-01", to: "2026-10-01" }, TODAY).ok, false);
  assert.equal((P.validateCustomRange({ from: "2025-01-01", to: "2026-10-01" }, TODAY) as { reason: string }).reason, "tooLong");
  assert.deepEqual(P.validateCustomRange({ from: "2025-10-27", to: "2026-10-27" }, TODAY), { ok: true, days: 366 });
  assert.deepEqual(P.pickDraftDay({ from: null, to: null }, "2026-10-05"), { from: "2026-10-05", to: null });
  assert.deepEqual(P.pickDraftDay({ from: "2026-10-05", to: null }, "2026-10-09"), { from: "2026-10-05", to: "2026-10-09" });
  assert.deepEqual(P.pickDraftDay({ from: "2026-10-05", to: null }, "2026-10-01"), { from: "2026-10-01", to: null });
  assert.deepEqual(P.pickDraftDay({ from: "2026-10-05", to: "2026-10-09" }, "2026-10-12"), { from: "2026-10-12", to: null });
});

test("presets, rolling windows and month grids", () => {
  assert.deepEqual(P.presetRange("7", TODAY), { from: "2026-10-21", to: TODAY });
  assert.deepEqual(P.presetRange("ytd", TODAY), { from: "2026-01-01", to: TODAY });
  assert.deepEqual(P.rollingRange(30, TODAY), { from: "2026-09-28", to: TODAY });
  const g = P.monthGrid("2026-10-15");
  assert.equal(g.lead, 3); // Oct 1 2026 is a Thursday
  assert.equal(g.days.length, 31);
  assert.equal(P.isPeriod("week"), true);
  assert.equal(P.isPeriod("decade"), false);
  assert.equal(P.elapsedEnd(P.periodRange("month", TODAY, null, TODAY, FIRST), TODAY), TODAY);
});
