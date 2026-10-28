import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../src/domain/trend.ts";
import { periodRange } from "../src/domain/periods.ts";
import { row } from "./helpers.ts";

const TODAY = "2026-10-27";
const tok = (n: number) => ({ input: n, output: 0, cacheRead: 0, cacheWrite: 0 });

test("series by engine follow registry order; by model keep top 6 + other", () => {
  const rows = [row({ engine: "omp", ...tok(5) }), row({ engine: "claude", ...tok(1) }), row({ engine: "zeta", ...tok(1) })];
  assert.deepEqual(T.seriesDefs(rows, "engine", "Other").map((d) => d.key), ["claude", "omp", "zeta"]);
  const many = Array.from({ length: 8 }, (_, i) => row({ model: `m${i}`, ...tok(100 - i) }));
  const defs = T.seriesDefs(many, "model", "其他");
  assert.equal(defs.length, 7);
  assert.equal(defs[6].key, T.OTHER_KEY);
  assert.equal(defs[6].name, "其他");
  assert.equal(T.seriesDefs(many.slice(0, 3), "model", "x").length, 3);
});

test("month trend: day buckets, future days get the forecast, other models fold into 'other'", () => {
  const pr = periodRange("month", TODAY, null, TODAY, "2026-05-01");
  const daily = [
    row({ bucket: "2026-10-01", model: "a", ...tok(10) }),
    row({ bucket: TODAY, model: "b", ...tok(20) }),
  ];
  const b = T.trendBuckets({ pr, today: TODAY, nowHour: 21, daily, hourly: [], by: "engine", otherLabel: "o", avg: 7 });
  assert.equal(b.length, 31);
  assert.equal(b[0].total, 10);
  assert.deepEqual(b[0].drill, { kind: "day", key: "2026-10-01" });
  const today = b.find((x) => x.key === TODAY)!;
  assert.equal(today.isNow, true);
  assert.equal(today.forecast, 0);
  const future = b.find((x) => x.key === "2026-10-30")!;
  assert.equal(future.future, true);
  assert.equal(future.forecast, 7);
  assert.equal(future.total, 0);
});

test("day trend uses 24 hour buckets with future hours", () => {
  const pr = periodRange("day", TODAY, null, TODAY, null);
  const hourly = [row({ bucket: `${TODAY}T03`, ...tok(5) }), row({ bucket: `${TODAY}T03`, engine: "codex", ...tok(5) })];
  const b = T.trendBuckets({ pr, today: TODAY, nowHour: 10, daily: [], hourly, by: "engine", otherLabel: "o", avg: 99 });
  assert.equal(b.length, 24);
  assert.equal(b[3].total, 10);
  assert.deepEqual(b[3].parts.map((p) => [p.key, p.v]), [["claude", 5], ["codex", 5]]);
  assert.equal(b[10].isNow, true);
  assert.equal(b[11].future, true);
  assert.equal(b[11].forecast, 0); // hour buckets never forecast
  assert.equal(b[3].drill, null);
});

test("long custom ranges use week buckets; year uses months", () => {
  const pr = periodRange("custom", TODAY, { from: "2026-07-01", to: TODAY }, TODAY, null);
  const b = T.trendBuckets({ pr, today: TODAY, nowHour: 0, daily: [row({ bucket: "2026-07-03", ...tok(4) })], hourly: [], by: "engine", otherLabel: "o", avg: 0 });
  assert.equal(b[0].gran, "week");
  assert.equal(b[0].total, 4);
  assert.deepEqual(b[0].drill, { kind: "week", key: "2026-07-01" });
  assert.equal(b[b.length - 1].to, TODAY);
  const yr = periodRange("year", TODAY, null, TODAY, null);
  const ym = T.trendBuckets({ pr: yr, today: TODAY, nowHour: 0, daily: [row({ bucket: "2026-02-10", ...tok(3) })], hourly: [], by: "model", otherLabel: "o", avg: 5 });
  assert.equal(ym.length, 12);
  assert.equal(ym[1].total, 3);
  assert.equal(ym[9].isNow, true);
  assert.equal(ym[10].future, true);
  assert.equal(ym[10].forecast, 0);
});

test("niceCeil rounds to readable axis steps", () => {
  assert.equal(T.niceCeil(0), 1);
  assert.equal(T.niceCeil(7.2e8), 8e8);
  assert.equal(T.niceCeil(1.2e3), 1.5e3);
  assert.equal(T.niceCeil(100), 100);
  assert.equal(T.niceCeil(9.1), 10);
});
