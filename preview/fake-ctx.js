/**
 * Fake PluginContext & UsageCaps for the preview harness. Registrations are
 * collected into `registry` (observable) for the mock host frame to render.
 */
import { buildLimits, buildUsage, keyOf, SOURCES, WORKSPACES } from "./fake-data.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function emitter() {
  const subs = new Set();
  return {
    on(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    emit(v) {
      for (const cb of [...subs]) cb(v);
    },
  };
}

export function createFakeCtx(params, host) {
  const now = () => Date.now();
  const scenario = params.get("scenario") || "normal";
  const historyDays = params.get("history") === "recent" ? 7 : 170;
  let usage = buildUsage({ now: now(), historyDays, empty: scenario === "empty" });
  let scanning = scenario === "scanning";
  const limitParams = {
    claude: params.get("claude") || "ok",
    codex: params.get("codex") || "ok",
    tight: params.get("tight") === "1",
  };
  const change = emitter();
  const progress = emitter();
  const bus = new Map();
  const storage = new Map();
  if (params.get("prefs")) storage.set("prefs:v1", JSON.parse(params.get("prefs")));
  const calls = [];
  let lastRescanAt = 0;
  const log = (name, arg) => calls.push({ name, arg, at: now() });

  if (scanning) {
    let done = 0;
    const total = 3460;
    const engines = ["claude", "codex", "omp", "pi"];
    const timer = setInterval(() => {
      done = Math.min(total, done + 37);
      progress.emit({ done, total, engine: engines[Math.min(3, Math.floor((done / total) * 4))], finished: false });
      if (params.get("finishScan") === "1" && done >= total) {
        clearInterval(timer);
        scanning = false;
        progress.emit({ done, total, engine: null, finished: true });
        change.emit({ scannedAt: now() });
      }
    }, 120);
    progress.emit({ done: 1284, total, engine: "omp", finished: false });
  }

  const ctx = {
    pluginId: "usage-limits",
    version: "0.1.0",
    react: window.React,
    host: { appVersion: "1.1.9", sdkVersion: "0.3.23", locale: params.get("locale") || "zh-CN", isWeb: false },
    ui: {
      registerStatusBarItem: (def) => host.register("status", def),
      registerCenterTab: (def) => host.register("tab", def),
      registerSettingsSection: (def) => host.register("settings", def),
      registerSidebarNav: (def) => host.register("nav", def),
      registerCommand: (def) => host.register("command", def),
      openCenterTab: (key) => host.openTab(key),
      openSettings: (key) => host.openSettings(key),
    },
    storage: {
      async get(key) {
        await wait(5);
        return storage.has(key) ? structuredClone(storage.get(key)) : null;
      },
      async set(key, value) {
        await wait(5);
        storage.set(key, structuredClone(value));
      },
      async delete(key) {
        storage.delete(key);
      },
    },
    events: {
      on(topic, cb) {
        const subs = bus.get(topic) ?? new Set();
        subs.add(cb);
        bus.set(topic, subs);
        return () => subs.delete(cb);
      },
      emit(topic, data) {
        for (const cb of [...(bus.get(topic) ?? [])]) cb(data);
      },
    },
    workspaces: {
      async list() {
        await wait(20);
        return WORKSPACES;
      },
      async add() {},
    },
    usage: {
      async query(q) {
        log("usage.query", q);
        await wait(scenario === "slow" ? 1500 : 60);
        if (params.get("usageError") === "1") throw new Error("usage index unavailable (database is locked)");
        const inRange = (day) => day >= q.from && day <= q.to;
        let rows = [];
        if (!scanning) {
          if (q.bucket === "hour") {
            // The plugin only asks for one day of hour buckets at a time.
            rows = q.from === q.to ? usage.hourRows(q.from) : [];
          } else {
            rows = usage.dayRows.filter((r) => inRange(r.bucket));
          }
        }
        return {
          rows,
          firstDay: scanning ? null : usage.firstDay,
          scannedAt: now() - 2 * 60_000,
          scanning,
          unknownModels: scanning ? [] : usage.unknownModels,
        };
      },
      async sources() {
        await wait(80);
        return SOURCES.map((s) => ({ ...s, lastScanAt: now() - 60_000 }));
      },
      async refresh() {
        log("usage.refresh");
        await wait(700);
        if (params.get("refreshError") === "1") throw new Error("scan failed: permission denied");
        change.emit({ scannedAt: now() });
        return { filesScanned: 3, eventsAdded: 12, durationMs: 40, scannedAt: now() };
      },
      async rescan() {
        log("usage.rescan");
        // Mirrors the host: a second full rescan within 60 s is rejected.
        if (lastRescanAt && now() - lastRescanAt < 60_000) {
          await wait(80);
          throw new Error(`a full rescan ran moments ago; try again in ${Math.ceil((60_000 - (now() - lastRescanAt)) / 1000)}s`);
        }
        lastRescanAt = now();
        for (let i = 1; i <= 10; i += 1) {
          await wait(120);
          progress.emit({ done: i * 346, total: 3460, engine: i < 5 ? "claude" : "omp", finished: false });
        }
        progress.emit({ done: 3460, total: 3460, engine: null, finished: true });
        usage = buildUsage({ now: now(), historyDays: Math.min(historyDays, 30) });
        change.emit({ scannedAt: now() });
        return { filesScanned: 3460, eventsAdded: 9000, durationMs: 1200, scannedAt: now() };
      },
      async prices() {
        log("usage.prices");
        await wait(40);
        return { source: "bundled", snapshotDate: "2026-10-20", updatedAt: null, models: 2140 };
      },
      async updatePrices() {
        log("usage.updatePrices");
        await wait(600);
        return { source: "online", snapshotDate: keyOf(new Date()), updatedAt: now(), models: 2163 };
      },
      onChange: (cb) => change.on(cb),
      onScanProgress: (cb) => progress.on(cb),
    },
    limits: {
      async get(opts = {}) {
        log("limits.get", opts);
        await wait(scenario === "slow" ? 1500 : 250);
        const res = buildLimits({ now: now(), ...limitParams });
        const want = opts.providers ?? ["claude", "codex"];
        return { providers: res.providers.filter((p) => want.includes(p.id)) };
      },
    },
  };
  return { ctx, calls, storage };
}
