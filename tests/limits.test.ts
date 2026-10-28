import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/domain/limits.ts";
import { provider, win } from "./helpers.ts";

const H = 3_600_000;
const NOW = new Date(2026, 9, 27, 21, 6).getTime();

test("bar level only looks at the used share", () => {
  assert.equal(L.barLevel(69), "ok");
  assert.equal(L.barLevel(70), "warn");
  assert.equal(L.barLevel(90), "danger");
});

test("pace: on track → projected share at reset", () => {
  // 5h window, 2h left (60% elapsed), 30% used → projected 50%
  const p = L.pace(win({ usedPercent: 30, resetsAt: NOW + 2 * H }), NOW);
  assert.equal(p.kind, "ok");
  assert.ok(p.kind === "ok" && Math.abs(p.marker - 0.6) < 1e-9 && Math.abs(p.projected - 0.5) < 1e-9);
});

test("pace: too fast → run-out time and how much earlier than the reset", () => {
  // 5h window, 3h05m left → elapsed 38.33%; 86% used
  const p = L.pace(win({ usedPercent: 86, resetsAt: NOW + 185 * 60_000 }), NOW);
  assert.equal(p.kind, "over");
  if (p.kind !== "over") return;
  const elapsedMs = 5 * H - 185 * 60_000;
  const rate = 0.86 / elapsedMs;
  assert.ok(Math.abs(p.runOutMs - 0.14 / rate) < 1);
  assert.ok(Math.abs(p.earlyMs - (185 * 60_000 - 0.14 / rate)) < 1);
  assert.ok(p.runOutMs < 20 * 60_000 && p.runOutMs > 18 * 60_000); // ≈ 19 minutes, as in the design
});

test("pace: idle, early, exhausted and unknown windows", () => {
  assert.equal(L.pace(win({ usedPercent: 0, resetsAt: NOW + H }), NOW).kind, "idle");
  assert.equal(L.pace(win({ usedPercent: 0, resetsAt: NOW + H }), NOW).marker, null);
  const early = L.pace(win({ usedPercent: 5, resetsAt: NOW + 5 * H - 60_000 }), NOW);
  assert.equal(early.kind, "early");
  assert.equal(L.pace(win({ usedPercent: 100, resetsAt: NOW + H }), NOW).kind, "exhausted");
  assert.equal(L.pace(win({ usedPercent: 40, resetsAt: null }), NOW).kind, "unknown");
  assert.equal(L.pace(win({ id: "mystery", windowSeconds: null, usedPercent: 40, resetsAt: NOW + H }), NOW).kind, "unknown");
  // reset already passed → elapsed clamps to 1
  const past = L.pace(win({ usedPercent: 40, resetsAt: NOW - H }), NOW);
  assert.equal(past.kind, "ok");
});

test("window info: spans from duration, weekly naming, model-scoped windows", () => {
  assert.deepEqual(L.windowInfo(win()), { span: { unit: "h", n: 5 }, weekly: false, model: null, short: "5h" });
  const seven = L.windowInfo(win({ id: "seven_day", kind: "weekly", windowSeconds: 604800 }));
  assert.deepEqual([seven.short, seven.weekly], ["7d", false]);
  const weekly = L.windowInfo(win({ id: "weekly", kind: "weekly", windowSeconds: null }));
  assert.deepEqual([weekly.short, weekly.weekly, weekly.span?.n], ["7d", true, 7]);
  const opus = L.windowInfo(win({ id: "seven_day_opus", kind: "weekly", windowSeconds: 604800 }));
  assert.deepEqual([opus.model, opus.short], ["Opus", "Opus"]);
  const scoped = L.windowInfo(win({ id: "scoped:claude-fable", kind: "other", label: "Fable", windowSeconds: 604800 }));
  assert.deepEqual([scoped.model, scoped.short], ["Fable", "Fable"]);
  assert.equal(L.scopedModelName(win({ id: "scoped:x-model", label: null })), "x-model");
  const odd = L.windowInfo(win({ id: "odd", kind: "other", label: "Burst", windowSeconds: null }));
  assert.equal(odd.short, "Burst");
  assert.equal(L.windowInfo(win({ id: "session", windowSeconds: 7200 })).short, "2h");
});

test("providers: windows, staleness, login commands, weekly-only plans", () => {
  assert.equal(L.hasWindows(provider({ windows: [win()] })), true);
  assert.equal(L.hasWindows(provider({ status: "offline", windows: [win()] })), true);
  assert.equal(L.hasWindows(provider({ status: "expired", windows: [win()] })), false);
  assert.equal(L.isStale(provider({ status: "rateLimited" })), true);
  assert.equal(L.loginCommand("claude"), "claude");
  assert.equal(L.loginCommand("codex"), "codex login");
  assert.equal(L.isWeeklyOnly(provider({ windows: [win({ id: "weekly", kind: "weekly", windowSeconds: 604800 })] })), true);
  assert.equal(L.isWeeklyOnly(provider({ windows: [win(), win({ id: "weekly" })] })), false);
});

test("alert thresholds: warn at the lowest, danger at the highest (or 95%)", () => {
  const prefs = { on: true, thresholds: [80, 95] };
  assert.equal(L.alertLevel(79, prefs), null);
  assert.equal(L.alertLevel(80, prefs), "warn");
  assert.equal(L.alertLevel(95, prefs), "danger");
  assert.equal(L.alertLevel(99, { on: false, thresholds: [80] }), null);
  assert.equal(L.alertLevel(99, { on: true, thresholds: [] }), null);
  assert.equal(L.alertLevel(90, { on: true, thresholds: [70] }), "warn");
  assert.equal(L.alertLevel(96, { on: true, thresholds: [70] }), "danger");
  assert.equal(L.alertLevel(90, { on: true, thresholds: [90, 70] }), "danger");
});

test("limit alert picks the tightest window among enabled providers with data", () => {
  const providers = [
    provider({ id: "claude", windows: [win({ usedPercent: 52 }), win({ id: "seven_day", usedPercent: 86.4 })] }),
    provider({ id: "codex", windows: [win({ usedPercent: 99 })], status: "expired" }),
  ];
  const a = L.limitAlert(providers, ["claude", "codex"], { on: true, thresholds: [80, 95] });
  assert.equal(a?.provider, "claude");
  assert.equal(a?.pct, 86);
  assert.equal(a?.level, "warn");
  assert.equal(L.limitAlert(providers, ["codex"], { on: true, thresholds: [80] }), null);
  assert.deepEqual(L.providerTops([], ["claude"], { on: true, thresholds: [80] }), []);
});

test("provider tops: one tag per enabled provider, in provider order", () => {
  const providers = [
    provider({ id: "claude", windows: [win({ usedPercent: 52 }), win({ id: "seven_day", usedPercent: 86.4 })] }),
    provider({
      id: "codex",
      plan: "Pro",
      windows: [win({ id: "session", usedPercent: 8 }), win({ id: "weekly", kind: "weekly", windowSeconds: 604800, usedPercent: 99 })],
    }),
  ];
  const prefs = { on: true, thresholds: [80, 95] };
  const tops = L.providerTops(providers, ["claude", "codex"], prefs);
  assert.deepEqual(
    tops.map((t) => [t.provider, t.window.id, t.pct, t.level]),
    [
      ["claude", "seven_day", 86, "warn"],
      ["codex", "weekly", 99, "danger"],
    ],
  );
  // Provider order, not tightness order: the tags never swap places.
  assert.deepEqual(L.providerTops(providers, ["codex", "claude"], prefs).map((t) => t.provider), ["codex", "claude"]);
  // Alerts off / provider disabled / no live windows.
  assert.deepEqual(L.providerTops(providers, ["claude"], { on: false, thresholds: [] }).map((t) => t.level), [null]);
  assert.deepEqual(L.providerTops([provider({ status: "signedOut" })], ["claude"], prefs), []);
});

test("provider tags: 5h + weekly side by side, scoped windows stay on the page", () => {
  const providers = [
    provider({
      id: "claude",
      windows: [
        win({ id: "five_hour", usedPercent: 86.4 }),
        win({ id: "seven_day", kind: "weekly", windowSeconds: 604800, usedPercent: 37 }),
        win({ id: "scoped:fable", kind: "other", label: "Fable", windowSeconds: 604800, usedPercent: 2 }),
      ],
    }),
    provider({ id: "codex", plan: "Free", windows: [win({ id: "weekly", kind: "weekly", windowSeconds: 604800, usedPercent: 46 })] }),
  ];
  const prefs = { on: true, thresholds: [80, 95] };
  const tags = L.providerTags(providers, ["claude", "codex"], prefs);
  assert.deepEqual(
    tags.map((t) => [t.provider, t.windows.map((w) => [w.window.id, w.pct]), t.pct, t.level]),
    [
      ["claude", [["five_hour", 86], ["seven_day", 37]], 86, "warn"],
      ["codex", [["weekly", 46]], 46, null],
    ],
  );
  // A provider with only scoped windows falls back to its tightest one.
  const scoped = [provider({ id: "claude", windows: [win({ id: "scoped:x", kind: "other", label: "X", usedPercent: 91 })] })];
  assert.deepEqual(L.providerTags(scoped, ["claude"], prefs).map((t) => [t.windows.length, t.pct, t.level]), [[1, 91, "warn"]]);
  assert.deepEqual(L.providerTags(providers, ["codex"], prefs).map((t) => t.provider), ["codex"]);
});

test("bar geometry: fill is used %, tick is elapsed share", () => {
  assert.deepEqual(L.barGeometry(30, 0.6), { used: 30, tick: 60 });
  assert.deepEqual(L.barGeometry(120, null), { used: 100, tick: null });
});

test("mergeProviders replaces refreshed providers without mutating the previous list", () => {
  const prev = [provider({ id: "claude", plan: "old" }), provider({ id: "codex", plan: "keep" })];
  const merged = L.mergeProviders(prev, [provider({ id: "claude", plan: "new" })]);
  assert.deepEqual(merged.map((p) => p.plan), ["new", "keep"]);
  assert.equal(prev[0].plan, "old");
  assert.equal(L.mergeProviders([], [provider({ id: "codex" })]).length, 1);
});
