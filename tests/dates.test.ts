import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain/dates.ts";

test("day keys round-trip and validate", () => {
  assert.equal(D.keyOf(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(D.keyOf(D.fromKey("2026-10-27")), "2026-10-27");
  assert.equal(D.isDayKey("2026-02-29"), false);
  assert.equal(D.isDayKey("2028-02-29"), true);
  assert.equal(D.isDayKey("2026-1-5"), false);
  assert.equal(D.isDayKey(42), false);
  assert.throws(() => D.fromKey("nope"), /Invalid day key/);
});

test("weeks start on Monday", () => {
  assert.equal(D.startOfWeek("2026-10-27"), "2026-10-26"); // Tue → Mon
  assert.equal(D.startOfWeek("2026-10-26"), "2026-10-26"); // Mon
  assert.equal(D.startOfWeek("2026-11-01"), "2026-10-26"); // Sun → previous Mon
  assert.equal(D.weekdayIndex("2026-11-01"), 6);
  assert.equal(D.weekdayIndex("2026-10-26"), 0);
});

test("month / year arithmetic", () => {
  assert.equal(D.addMonths("2026-01-31", 1), "2026-02-01");
  assert.equal(D.shiftMonthsClamped("2026-01-31", 1), "2026-02-28");
  assert.equal(D.shiftMonthsClamped("2026-03-15", -3), "2025-12-15");
  assert.equal(D.endOfMonth("2028-02-10"), "2028-02-29");
  assert.equal(D.startOfMonth("2026-10-27"), "2026-10-01");
  assert.equal(D.startOfYear("2026-10-27"), "2026-01-01");
  assert.equal(D.endOfYear("2026-10-27"), "2026-12-31");
});

test("daysBetween is DST safe and eachDay is inclusive", () => {
  assert.equal(D.daysBetween("2026-03-01", "2026-04-01"), 31);
  assert.equal(D.daysBetween("2026-10-27", "2026-10-27"), 0);
  assert.deepEqual(D.eachDay("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.equal(D.minKey("2026-01-02", "2026-01-01"), "2026-01-01");
  assert.equal(D.maxKey("2026-01-02", "2026-01-01"), "2026-01-02");
  assert.equal(D.todayKey(new Date(2026, 9, 27, 23, 59).getTime()), "2026-10-27");
  assert.equal(D.keyOf(D.startOfDay(new Date(2026, 9, 27, 13))), "2026-10-27");
});

test("parseBucket splits hour buckets", () => {
  assert.deepEqual(D.parseBucket("2026-10-27T14"), { day: "2026-10-27", hour: 14 });
  assert.deepEqual(D.parseBucket("2026-10-27"), { day: "2026-10-27", hour: null });
});
