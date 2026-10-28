import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../src/domain/aggregate.ts";
import { row } from "./helpers.ts";

test("sumRows: tokens exclude reasoning; unpriced rows count as unknown, not guessed", () => {
  const rows = [row({ cost: 2 }), row({ model: "mystery", cost: null, input: 10, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 })];
  const s = A.sumRows(rows);
  assert.equal(s.total, 1000 + 10);
  assert.equal(s.reasoning, 10);
  assert.equal(s.cost, 2);
  assert.equal(s.unknownTokens, 10);
  assert.deepEqual(s.unknownModels, ["mystery"]);
  assert.equal(A.sumRows(rows, 0.5).total, 505);
  assert.equal(A.sumRows([]).total, 0);
});

test("filterRows by range, engine and exclusions (day and hour buckets)", () => {
  const rows = [
    row({ bucket: "2026-10-01", engine: "claude" }),
    row({ bucket: "2026-10-02", engine: "codex" }),
    row({ bucket: "2026-10-03T05", engine: "pi" }),
  ];
  assert.equal(A.filterRows(rows, { from: "2026-10-02" }).length, 2);
  assert.equal(A.filterRows(rows, { to: "2026-10-02" }).length, 2);
  assert.equal(A.filterRows(rows, { engine: "codex" }).length, 1);
  assert.equal(A.filterRows(rows, { excluded: ["claude", "pi"] }).length, 1);
  assert.equal(A.filterRows(rows, {}).length, 3);
});

test("activeDays counts distinct days with tokens", () => {
  const rows = [row({ bucket: "2026-10-01" }), row({ bucket: "2026-10-01", engine: "codex" }), row({ bucket: "2026-10-02", input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })];
  assert.equal(A.activeDays(rows), 1);
});

test("engine shares and model ranking (dominant engine, priced flag)", () => {
  const rows = [
    row({ engine: "omp", model: "kimi", input: 300, output: 0, cacheRead: 0, cacheWrite: 0 }),
    row({ engine: "pi", model: "kimi", input: 100, output: 0, cacheRead: 0, cacheWrite: 0 }),
    row({ engine: "pi", model: "flash", input: 600, output: 0, cacheRead: 0, cacheWrite: 0, cost: null }),
  ];
  const shares = A.engineShares(rows);
  assert.deepEqual(shares.map((s) => [s.id, s.total, s.models]), [["pi", 700, 2], ["omp", 300, 1]]);
  assert.equal(Math.round(shares[0].share * 100), 70);
  const models = A.modelRanking(rows);
  assert.deepEqual(models.map((m) => m.model), ["flash", "kimi"]);
  assert.equal(models[1].engine, "omp");
  assert.deepEqual(models[1].engines, ["omp", "pi"]);
  assert.equal(models[0].priced, false);
  assert.equal(models[1].priced, true);
});

test("project ranking resolves cwd and tracks last active day", () => {
  const rows = [
    row({ project: "/w/a", bucket: "2026-10-01" }),
    row({ project: "/w/a/sub", bucket: "2026-10-05" }),
    row({ project: null, bucket: "2026-10-03", input: 1, output: 0, cacheRead: 0, cacheWrite: 0 }),
  ];
  const resolve = (cwd: string | null) => (cwd && cwd.startsWith("/w/a") ? { id: "a", name: "A", path: "/w/a" } : { id: "__other", name: "Other", path: null });
  const ranking = A.projectRanking(rows, resolve);
  assert.deepEqual(ranking.map((p) => [p.id, p.total, p.last]), [["a", 2000, "2026-10-05"], ["__other", 1, "2026-10-03"]]);
});

test("recent daily average uses the last 7 active days before today", () => {
  const rows = [
    row({ bucket: "2026-10-27", input: 9999 }), // today: ignored
    ...Array.from({ length: 9 }, (_, i) => row({ bucket: `2026-10-${String(10 + i).padStart(2, "0")}`, input: (i + 1) * 1000, output: 0, cacheRead: 0, cacheWrite: 0 })),
    row({ bucket: "2026-10-20", input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), // idle day skipped
  ];
  // last 7 active days before today: inputs 3000..9000 → mean 6000
  assert.equal(A.recentDailyAvg(rows, "2026-10-27"), 6000);
  assert.equal(A.recentDailyAvg([], "2026-10-27"), 0);
});

test("forecast = period to date + remaining days × average", () => {
  assert.equal(A.forecastTotal({ periodTotal: 100, to: "2026-10-31", today: "2026-10-27", avg: 10 }), 140);
  assert.equal(A.forecastTotal({ periodTotal: 100, to: "2026-10-27", today: "2026-10-27", avg: 10 }), null);
  assert.equal(A.forecastTotal({ periodTotal: 100, to: "2026-10-31", today: "2026-10-27", avg: 0 }), null);
});

test("today vs yesterday compares up to the same time of day", () => {
  const today = [row({ bucket: "2026-10-27T09", input: 300, output: 0, cacheRead: 0, cacheWrite: 0 })];
  const yesterday = [
    row({ bucket: "2026-10-26T08", input: 100, output: 0, cacheRead: 0, cacheWrite: 0 }),
    row({ bucket: "2026-10-26T09", input: 200, output: 0, cacheRead: 0, cacheWrite: 0 }),
    row({ bucket: "2026-10-26T20", input: 5000, output: 0, cacheRead: 0, cacheWrite: 0 }),
  ];
  const now = new Date(2026, 9, 27, 9, 30);
  // yesterday until 09:30 = 100 + 200 × 0.5 = 200 → +50%
  assert.equal(A.todayVsYesterday(today, yesterday, now), 0.5);
  assert.equal(A.todayVsYesterday(today, [], now), null);
  assert.deepEqual(A.hourlyTotals([row({ bucket: "2026-10-26T23" }), row({ bucket: "2026-10-26" })]).slice(22), [0, 1000]);
  assert.equal(A.sameTimeTotal([1, 2, 3], 2, 2), 6);
  assert.equal(A.delta(150, 100), 0.5);
  assert.equal(A.delta(1, 0), null);
});

test("dailyTotals sums per bucket", () => {
  const m = A.dailyTotals([row({ bucket: "2026-10-01" }), row({ bucket: "2026-10-01" })]);
  assert.equal(m.get("2026-10-01"), 2000);
});

test("cacheHitRate: cache reads over prompt tokens, null when there is nothing", () => {
  assert.equal(A.cacheHitRate({ input: 0, cacheRead: 0 }), null);
  assert.equal(A.cacheHitRate({ input: 50, cacheRead: 50 }), 0.5);
  assert.equal(A.cacheHitRate({ input: 0, cacheRead: 100 }), 1);
  assert.equal(A.cacheHitRate({ input: 100, cacheRead: 0 }), 0);
});
