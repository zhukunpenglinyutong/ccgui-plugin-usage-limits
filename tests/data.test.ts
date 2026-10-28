import test from "node:test";
import assert from "node:assert/strict";
import { createPrefs, PREFS_KEY } from "../src/data/prefs.ts";
import { createLimitsService } from "../src/data/limits.ts";
import { createUsageService } from "../src/data/usage.ts";
import { createStore, errorText } from "../src/data/store.ts";
import { DEFAULT_PREFS } from "../src/domain/prefs.ts";
import { provider, row, win } from "./helpers.ts";
import type { UsageCtx } from "../src/sdk-usage";

const flush = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function memoryKV(seed: Record<string, unknown> = {}, failSet = false) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    async get<T>(k: string) {
      return (map.get(k) ?? null) as T | null;
    },
    async set(k: string, v: unknown) {
      if (failSet) throw new Error("disk full");
      map.set(k, v);
    },
  };
}

test("store: immutable updates notify; identical results do not", () => {
  const s = createStore({ n: 1 });
  let calls = 0;
  const off = s.subscribe(() => (calls += 1));
  s.set((p) => ({ n: p.n + 1 }));
  s.set((p) => p);
  assert.equal(s.get().n, 2);
  assert.equal(calls, 1);
  off();
  s.set(() => ({ n: 9 }));
  assert.equal(calls, 1);
  assert.equal(errorText(new Error("x")), "x");
  assert.equal(errorText("y"), "y");
  assert.equal(errorText({ a: 1 }), '{"a":1}');
  assert.equal(errorText({}), "unknown error");
});

test("prefs: load sanitizes, edits save debounced, save errors stay visible", async () => {
  const kv = memoryKV({ [PREFS_KEY]: { chipMode: "cost", alerts: { thresholds: [95, 12] } } });
  const prefs = createPrefs(kv);
  await prefs.load();
  assert.equal(prefs.get().chipMode, "cost");
  assert.deepEqual(prefs.get().alerts.thresholds, [95]);
  prefs.update((p) => ({ ...p, logo: false }));
  await prefs.flush();
  assert.equal((kv.map.get(PREFS_KEY) as typeof DEFAULT_PREFS).logo, false);
  const broken = createPrefs(memoryKV({}, true));
  broken.update((p) => ({ ...p, chipMode: "tokens" }));
  await broken.flush();
  assert.equal(broken.store.get().saveError, "disk full");
  broken.dispose();
  prefs.dispose();
});

function fakeCtx(over: Partial<{ fail: boolean; limits: ReturnType<typeof provider>[] }> = {}) {
  const calls: string[] = [];
  const events = new Map<string, (d: unknown) => void>();
  let changeCb: ((e: { scannedAt: number }) => void) | null = null;
  const ctx = {
    storage: memoryKV(),
    events: {
      on(topic: string, cb: (d: unknown) => void) {
        events.set(topic, cb);
        return () => events.delete(topic);
      },
      emit() {},
    },
    workspaces: { list: async () => [{ id: "w", name: "app", path: "/work/app", groupId: null, lastOpenedAt: null }] },
    usage: {
      async query(q: { from: string; to: string; bucket?: string }) {
        calls.push(`query:${q.bucket}:${q.from}..${q.to}`);
        if (over.fail) throw new Error("db locked");
        const rows = q.bucket === "hour" ? [row({ bucket: `${q.from}T09` })] : [row({ bucket: q.to }), row({ bucket: q.from })];
        return { rows, firstDay: "2026-10-01", scannedAt: 1, scanning: false, unknownModels: ["m"] };
      },
      async sources() {
        return [];
      },
      async refresh() {
        calls.push("refresh");
        return { filesScanned: 1, eventsAdded: 1, durationMs: 1, scannedAt: 2 };
      },
      async rescan() {
        calls.push("rescan");
        return { filesScanned: 1, eventsAdded: 1, durationMs: 1, scannedAt: 2 };
      },
      async prices() {
        return { source: "bundled", snapshotDate: "2026-10-20", updatedAt: null, models: 3 };
      },
      async updatePrices() {
        calls.push("updatePrices");
        return { source: "online", snapshotDate: "2026-10-27", updatedAt: 5, models: 4 };
      },
      onChange(cb: (e: { scannedAt: number }) => void) {
        changeCb = cb;
        return () => (changeCb = null);
      },
      onScanProgress() {
        return () => undefined;
      },
    },
    limits: {
      async get(opts: { providers?: string[]; refresh?: boolean } = {}) {
        calls.push(`limits:${opts.refresh ? "refresh" : "cached"}:${(opts.providers ?? []).join(",")}`);
        if (over.fail) throw new Error("offline");
        return { providers: (over.limits ?? [provider({ windows: [win()] }), provider({ id: "codex" })]).filter((p) => !opts.providers || opts.providers.includes(p.id)) };
      },
    },
  } as unknown as UsageCtx;
  return { ctx, calls, events, change: () => changeCb?.({ scannedAt: 3 }) };
}

test("usage service: firstDay drives the all-time day query; hours for today + yesterday", async () => {
  const now = new Date(2026, 9, 27, 12).getTime();
  const f = fakeCtx();
  const svc = createUsageService({ ctx: f.ctx, now: () => now, chipScope: () => ({ period: "today", excluded: [] }) });
  await svc.reload();
  const s = svc.store.get();
  assert.equal(s.phase, "ready");
  assert.equal(s.firstDay, "2026-10-01");
  assert.equal(s.daily.length, 2);
  assert.ok(s.hourly["2026-10-27"] && s.hourly["2026-10-26"]);
  assert.deepEqual(f.calls.slice(0, 2), ["query:hour:2026-10-27..2026-10-27", "query:day:2026-10-01..2026-10-27"]);
  assert.equal(s.cache?.tokens, 1000);
  svc.ensureHours("2026-10-05");
  await flush();
  assert.ok(svc.store.get().hourly["2026-10-05"]);
  svc.ensureHours("bogus");
  await svc.loadWorkspaces();
  assert.equal(svc.store.get().workspaces.length, 1);
  svc.dispose();
});

test("usage service: query failures are visible and refresh rejects", async () => {
  const f = fakeCtx({ fail: true });
  const svc = createUsageService({ ctx: f.ctx, chipScope: () => ({ period: "today", excluded: [] }) });
  await svc.reload();
  assert.equal(svc.store.get().phase, "error");
  assert.equal(svc.store.get().error, "db locked");
  await assert.rejects(svc.refresh());
  assert.equal(svc.store.get().refreshError, "db locked");
  assert.equal(svc.store.get().refreshing, false);
  svc.dispose();
});

test("usage service: usage://done debounces an incremental refresh; onChange re-queries", async () => {
  const f = fakeCtx();
  const svc = createUsageService({ ctx: f.ctx, chipScope: () => ({ period: "today", excluded: [] }) });
  svc.init();
  await sleep(20);
  f.events.get("usage://updated")?.({});
  assert.equal(svc.store.get().running, true);
  f.events.get("usage://done")?.({});
  f.events.get("usage://done")?.({});
  assert.equal(svc.store.get().running, false);
  await sleep(2100);
  assert.equal(f.calls.filter((c) => c === "refresh").length, 1);
  const before = f.calls.length;
  f.change();
  await sleep(350);
  assert.ok(f.calls.length > before);
  svc.dispose();
});

test("usage service: rescan, prices and the 24 h auto update", async () => {
  const now = 1_800_000_000_000;
  const f = fakeCtx();
  const svc = createUsageService({ ctx: f.ctx, now: () => now, chipScope: () => ({ period: "today", excluded: [] }) });
  await svc.rescan();
  assert.ok(f.calls.includes("rescan"));
  assert.equal(svc.store.get().rescan.running, false);
  await svc.loadPrices();
  assert.equal(svc.store.get().prices.data?.models, 3);
  await svc.maybeAutoUpdatePrices(true);
  assert.equal(f.calls.filter((c) => c === "updatePrices").length, 1);
  await svc.maybeAutoUpdatePrices(true);
  assert.equal(f.calls.filter((c) => c === "updatePrices").length, 1, "second call within 24 h is skipped");
  await svc.maybeAutoUpdatePrices(false);
  assert.equal(svc.store.get().prices.data?.source, "online");
  svc.dispose();
});

test("limits service: enabled providers only, visibility-driven refresh, retry merge", async () => {
  let t = 1_000_000;
  const f = fakeCtx();
  const svc = createLimitsService({ ctx: f.ctx, now: () => t, config: { enabled: ["claude"], visibleMs: 300_000, background: false } });
  await svc.fetch(false);
  assert.deepEqual(svc.store.get().providers.map((p) => p.id), ["claude"]);
  assert.equal(f.calls.at(-1), "limits:cached:claude");
  svc.setVisible("popover", true);
  await flush();
  assert.equal(f.calls.at(-1), "limits:refresh:claude", "never refreshed → network refresh when shown");
  await flush();
  svc.setVisible("popover", false);
  t += 60_000;
  svc.setVisible("page", true);
  await flush();
  assert.equal(f.calls.at(-1), "limits:cached:claude", "fresh data → cached read only");
  svc.configure({ enabled: ["claude", "codex"], visibleMs: null, background: true });
  await flush();
  assert.equal(f.calls.at(-1), "limits:cached:claude,codex");
  await svc.retry("codex");
  assert.equal(f.calls.at(-1), "limits:refresh:codex");
  assert.deepEqual(svc.store.get().providers.map((p) => p.id), ["claude", "codex"]);
  svc.configure({ enabled: [], visibleMs: null, background: false });
  await svc.fetch(true);
  assert.deepEqual(svc.store.get().providers, []);
  svc.dispose();
});

test("limits service: whole-call failures surface as errors", async () => {
  const f = fakeCtx({ fail: true });
  const svc = createLimitsService({ ctx: f.ctx, config: { enabled: ["claude"], visibleMs: 300_000, background: false } });
  await assert.rejects(svc.fetch(true));
  assert.equal(svc.store.get().phase, "error");
  assert.equal(svc.store.get().error, "offline");
  await assert.rejects(svc.retry("claude"));
  assert.equal(svc.store.get().retrying.claude, false);
  svc.dispose();
});
