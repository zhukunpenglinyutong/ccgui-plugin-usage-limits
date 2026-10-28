import test from "node:test";
import assert from "node:assert/strict";
import * as F from "../src/domain/format.ts";

test("token, money, share formatting", () => {
  assert.equal(F.tokens(463_300_000), "463.3M");
  assert.equal(F.tokens(2.94e9), "2.9B");
  assert.equal(F.tokens(1500), "1.5K");
  assert.equal(F.tokens(999), "999");
  assert.equal(F.tokens(null), "—");
  assert.equal(F.usd(167.394), "$167.39");
  assert.equal(F.usd(3433.2), "$3,433");
  assert.equal(F.usd(0.004), "<$0.01");
  assert.equal(F.usd(0), "$0.00");
  assert.equal(F.usd(null), "—");
  assert.equal(F.int(52213.4), "52,213");
  assert.equal(F.share(0.00005), "<0.01%");
  assert.equal(F.share(0.0252), "2.52%");
  assert.equal(F.share(0.468), "46.8%");
  assert.equal(F.pct(0.444), "44%");
});

test("durations and relative times in zh and en", () => {
  const M = 60_000;
  assert.equal(F.durShort(72 * M), "1h 12m");
  assert.equal(F.durShort(28 * 60 * M), "1d 4h");
  assert.equal(F.durShort(5 * M), "5m");
  assert.equal(F.durLong(185 * M, "zh"), "3 小时 5 分");
  assert.equal(F.durLong(180 * M, "zh"), "3 小时");
  assert.equal(F.durLong(28 * 60 * M, "zh"), "1 天 4 小时");
  assert.equal(F.durLong(48 * 60 * M, "en"), "2 d");
  assert.equal(F.durLong(185 * M, "en"), "3 h 5 min");
  assert.equal(F.durLong(10_000, "zh"), "1 分钟");
  assert.equal(F.durLong(19 * M, "en"), "19 min");
  assert.equal(F.ago(5_000, "zh"), "刚刚");
  assert.equal(F.ago(120_000, "zh"), "2 分钟前");
  assert.equal(F.ago(2 * 3_600_000, "en"), "2 h ago");
  assert.equal(F.ago(3 * 86_400_000, "zh"), "3 天前");
  assert.equal(F.ago(null, "en"), "");
});

test("dates", () => {
  assert.equal(F.dateShort("2026-10-27", "zh"), "10月27日");
  assert.equal(F.dateShort("2026-10-27", "en"), "Oct 27");
  assert.equal(F.dateWeek("2026-10-27", "zh"), "10月27日 周二");
  assert.equal(F.dateWeek("2026-10-27", "en"), "Tue, Oct 27");
  assert.equal(F.monthLabel("2026-10-27", "zh"), "2026年10月");
  assert.equal(F.monthLabel("2026-10-27", "en"), "Oct 2026");
  assert.equal(F.monthShort("2026-02-01", "en"), "Feb");
  assert.equal(F.monthShort("2026-02-01", "zh"), "2月");
  assert.equal(F.yearLabel("2026-10-27", "zh"), "2026年");
  assert.equal(F.yearLabel("2026-10-27", "en"), "2026");
  assert.equal(F.dateRange("2026-10-01", "2026-10-27", "zh"), "10月1日 – 10月27日");
  assert.equal(F.hourRange(14), "14:00–15:00");
  assert.equal(F.hourRange(23), "23:00–24:00");
  const now = new Date(2026, 9, 27, 21, 6).getTime();
  assert.equal(F.resetAt(new Date(2026, 9, 27, 23, 1).getTime(), now, "zh"), "今天 23:01");
  assert.equal(F.resetAt(new Date(2026, 9, 28, 9, 0).getTime(), now, "en"), "tomorrow 09:00");
  assert.equal(F.resetAt(new Date(2026, 9, 29, 9, 0).getTime(), now, "zh"), "10月29日 周四 09:00");
  assert.equal(F.stamp(new Date(2026, 9, 20, 14, 3).getTime()), "2026-10-20 14:03");
});

test("rate: one decimal, trimmed", () => {
  assert.equal(F.rate(0.9867), "98.7%");
  assert.equal(F.rate(1), "100%");
  assert.equal(F.rate(0.4204), "42%");
  assert.equal(F.rate(0.004), "0.4%");
});
