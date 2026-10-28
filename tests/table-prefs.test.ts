import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../src/domain/table.ts";
import * as P from "../src/domain/prefs.ts";

test("sorting toggles direction; text columns start ascending", () => {
  assert.deepEqual(T.nextSort({ key: "total", dir: "desc" }, "total"), { key: "total", dir: "asc" });
  assert.deepEqual(T.nextSort({ key: "total", dir: "asc" }, "total"), { key: "total", dir: "desc" });
  assert.deepEqual(T.nextSort({ key: "total", dir: "desc" }, "model"), { key: "model", dir: "asc" });
  assert.deepEqual(T.nextSort({ key: "model", dir: "asc" }, "cost"), { key: "cost", dir: "desc" });
  assert.equal(T.ariaSort({ key: "cost", dir: "asc" }, "cost"), "ascending");
  assert.equal(T.ariaSort({ key: "cost", dir: "desc" }, "cost"), "descending");
  assert.equal(T.ariaSort({ key: "cost", dir: "asc" }, "total"), "none");
});

test("sortRows: stable, chronological 'key', nulls last", () => {
  const rows = [
    { order: 0, name: "b", cost: 2 },
    { order: 1, name: "a", cost: null },
    { order: 2, name: "c", cost: 2 },
  ];
  assert.deepEqual(T.sortRows(rows, { key: "key", dir: "desc" }).map((r) => r.order), [2, 1, 0]);
  assert.deepEqual(T.sortRows(rows, { key: "name", dir: "asc" }).map((r) => r.name), ["a", "b", "c"]);
  assert.deepEqual(T.sortRows(rows, { key: "cost", dir: "desc" }).map((r) => r.order), [0, 2, 1]);
  assert.deepEqual(T.sortRows(rows, { key: "cost", dir: "asc" }).map((r) => r.order), [0, 2, 1]);
  assert.equal(rows[0].order, 0);
  assert.deepEqual(T.DEFAULT_SORT.time, { key: "key", dir: "desc" });
});

test("sanitizePrefs keeps valid values and falls back to defaults", () => {
  assert.equal(P.sanitizePrefs(null), P.DEFAULT_PREFS);
  assert.equal(P.sanitizePrefs([]), P.DEFAULT_PREFS);
  const p = P.sanitizePrefs({
    chipMode: "limit",
    chipPeriod: "bogus",
    logo: false,
    providers: { claude: false, codex: "yes" },
    alerts: { on: false, thresholds: [95, 70, 70, 33, "80"] },
    excludedEngines: ["pi", "pi", 3, ""],
    collapsed: { claude: true, codex: "no" },
    trendBy: "model",
    autoRefresh: "off",
  });
  assert.equal(p.chipMode, "limit");
  assert.equal(p.chipPeriod, "today");
  assert.equal(p.logo, false);
  assert.deepEqual(p.providers, { claude: false, codex: true });
  assert.deepEqual(p.alerts, { on: false, thresholds: [70, 95], background: false });
  assert.deepEqual(p.excludedEngines, ["pi"]);
  assert.deepEqual(p.collapsed, { claude: true });
  assert.equal(p.trendBy, "model");
  assert.equal(p.autoRefresh, "off");
  assert.deepEqual(P.sanitizePrefs({ alerts: {} }).alerts.thresholds, [80, 95]);
  assert.deepEqual(P.sanitizeThresholds("x"), [80, 95]);
});

test("pref helpers", () => {
  assert.deepEqual(P.toggleThreshold([80, 95], 70), [70, 80, 95]);
  assert.deepEqual(P.toggleThreshold([80, 95], 80), [95]);
  assert.deepEqual(P.toggleInList(["a"], "b"), ["a", "b"]);
  assert.deepEqual(P.toggleInList(["a", "b"], "a"), ["b"]);
  assert.deepEqual(P.enabledProviders({ ...P.DEFAULT_PREFS, providers: { claude: false, codex: true } }), ["codex"]);
  assert.equal(P.autoRefreshMs("5"), 300_000);
  assert.equal(P.autoRefreshMs("off"), null);
  assert.deepEqual(P.chipRange("today", "2026-10-27"), { from: "2026-10-27", to: "2026-10-27" });
  assert.deepEqual(P.chipRange("7d", "2026-10-27"), { from: "2026-10-21", to: "2026-10-27" });
  assert.deepEqual(P.chipRange("month", "2026-10-27"), { from: "2026-10-01", to: "2026-10-27" });
});

test("price auto-update runs at most once per 24 h", () => {
  const now = 1_000_000_000_000;
  assert.equal(P.priceUpdateDue(false, null, now), false);
  assert.equal(P.priceUpdateDue(true, null, now), true);
  assert.equal(P.priceUpdateDue(true, now - 3_600_000, now), false);
  assert.equal(P.priceUpdateDue(true, now - P.PRICE_UPDATE_INTERVAL_MS, now), true);
  assert.equal(P.priceUpdateDue(true, now + 60_000, now), true); // clock moved backwards
  assert.equal(P.priceUpdateDue(true, Number.NaN, now), true);
});
