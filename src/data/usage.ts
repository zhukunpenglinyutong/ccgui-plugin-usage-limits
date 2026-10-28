/**
 * Usage data service: queries the host's read-only usage layer and keeps an
 * immutable snapshot for the UI.
 *
 * - One all-time day-bucket query (from the host's firstDay) feeds every
 *   aggregate; hour buckets are fetched per day on demand (today, yesterday
 *   and the dashboard's "day" anchor + its previous day).
 * - `usage://done` → incremental `ctx.usage.refresh()` debounced 2 s;
 *   `ctx.usage.onChange` → re-query (coalesced). Stale responses are
 *   dropped by a sequence number, never merged.
 * - The last status-bar number is cached in storage so the chip is never
 *   blank on startup.
 */
import type { PluginWorkspaceRow } from "../ccgui-plugin";
import type {
  UsageCtx,
  UsagePriceInfo,
  UsageScanProgress,
  UsageSourceStatus,
  UsageStatRow,
} from "../sdk-usage";
import { filterRows, sumRows } from "../domain/aggregate.ts";
import { addDays, isDayKey, todayKey, type DayKey } from "../domain/dates.ts";
import { chipRange, priceUpdateDue, type ChipPeriod } from "../domain/prefs.ts";
import { createStore, errorText, type Store } from "./store.ts";

export interface AsyncSlot<T> {
  phase: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
}

export interface ChipCache {
  day: DayKey;
  period: ChipPeriod;
  tokens: number;
  cost: number;
}

export interface UsageState {
  phase: "loading" | "ready" | "error";
  error: string | null;
  daily: UsageStatRow[];
  hourly: Record<DayKey, UsageStatRow[]>;
  hourlyError: Record<DayKey, string>;
  firstDay: DayKey | null;
  scannedAt: number | null;
  scanning: boolean;
  unknownModels: string[];
  today: DayKey;
  refreshing: boolean;
  refreshError: string | null;
  progress: UsageScanProgress | null;
  progressEngines: string[];
  sources: AsyncSlot<UsageSourceStatus[]>;
  prices: AsyncSlot<UsagePriceInfo>;
  priceUpdate: { running: boolean; error: string | null; lastAttemptAt: number | null; lastError: string | null };
  rescan: { running: boolean; error: string | null };
  workspaces: PluginWorkspaceRow[];
  workspacesError: string | null;
  running: boolean;
  cache: ChipCache | null;
}

export interface UsageService {
  store: Store<UsageState>;
  init(): void;
  reload(): Promise<void>;
  ensureHours(day: DayKey): void;
  refresh(): Promise<void>;
  rescan(): Promise<void>;
  loadSources(): Promise<void>;
  loadPrices(): Promise<void>;
  updatePrices(manual: boolean): Promise<void>;
  maybeAutoUpdatePrices(enabled: boolean): Promise<void>;
  loadWorkspaces(): Promise<void>;
  dispose(): void;
}

const CHIP_CACHE_KEY = "chip:v1";
const PRICE_ATTEMPT_KEY = "prices:auto:v1";
const DONE_DEBOUNCE_MS = 2000;
const CHANGE_DEBOUNCE_MS = 300;
const RUNNING_IDLE_MS = 15_000;
const DAY_TICK_MS = 60_000;

const slot = <T>(): AsyncSlot<T> => ({ phase: "idle", data: null, error: null });

export function initialUsageState(now: number): UsageState {
  return {
    phase: "loading",
    error: null,
    daily: [],
    hourly: {},
    hourlyError: {},
    firstDay: null,
    scannedAt: null,
    scanning: false,
    unknownModels: [],
    today: todayKey(now),
    refreshing: false,
    refreshError: null,
    progress: null,
    progressEngines: [],
    sources: slot(),
    prices: slot(),
    priceUpdate: { running: false, error: null, lastAttemptAt: null, lastError: null },
    rescan: { running: false, error: null },
    workspaces: [],
    workspacesError: null,
    running: false,
    cache: null,
  };
}

const omit = <V>(rec: Record<string, V>, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));

export function createUsageService(opts: {
  ctx: UsageCtx;
  now?: () => number;
  chipScope: () => { period: ChipPeriod; excluded: readonly string[] };
}): UsageService {
  const { ctx } = opts;
  const now = opts.now ?? (() => Date.now());
  const store = createStore<UsageState>(initialUsageState(now()));
  const disposers: (() => void)[] = [];
  const wanted = new Set<DayKey>();
  let seq = 0;
  let disposed = false;
  let doneTimer: ReturnType<typeof setTimeout> | null = null;
  let changeTimer: ReturnType<typeof setTimeout> | null = null;
  let runningTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshInFlight: Promise<void> | null = null;

  const patch = (fn: (s: UsageState) => UsageState): void => {
    if (!disposed) store.set(fn);
  };

  async function fetchHours(day: DayKey, mySeq: number): Promise<void> {
    try {
      const res = await ctx.usage.query({ from: day, to: day, bucket: "hour" });
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, hourly: { ...s.hourly, [day]: res.rows }, hourlyError: omit(s.hourlyError, day) }));
    } catch (error) {
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, hourlyError: { ...s.hourlyError, [day]: errorText(error) } }));
    }
  }

  function writeChipCache(s: UsageState): void {
    const scope = opts.chipScope();
    const range = chipRange(scope.period, s.today);
    const sum = sumRows(filterRows(s.daily, { ...range, excluded: scope.excluded }));
    const cache: ChipCache = { day: s.today, period: scope.period, tokens: sum.total, cost: sum.cost };
    const prev = s.cache;
    if (prev && prev.day === cache.day && prev.period === cache.period && prev.tokens === cache.tokens && prev.cost === cache.cost) return;
    patch((st) => ({ ...st, cache }));
    ctx.storage.set(CHIP_CACHE_KEY, cache).catch(() => undefined);
  }

  async function reload(): Promise<void> {
    seq += 1;
    const mySeq = seq;
    const today = todayKey(now());
    patch((s) => (s.today === today ? s : { ...s, today, hourly: {}, hourlyError: {} }));
    try {
      const head = await ctx.usage.query({ from: today, to: today, bucket: "hour" });
      if (mySeq !== seq) return;
      const firstDay = head.firstDay && isDayKey(head.firstDay) ? head.firstDay : null;
      const daily = firstDay ? await ctx.usage.query({ from: firstDay, to: today, bucket: "day" }) : head;
      if (mySeq !== seq) return;
      patch((s) => ({
        ...s,
        phase: "ready",
        error: null,
        firstDay,
        daily: firstDay ? daily.rows : [],
        hourly: { ...s.hourly, [today]: head.rows },
        hourlyError: omit(s.hourlyError, today),
        scannedAt: daily.scannedAt ?? head.scannedAt,
        scanning: daily.scanning || head.scanning,
        unknownModels: daily.unknownModels,
        progress: daily.scanning || head.scanning ? s.progress : null,
      }));
      writeChipCache(store.get());
      const days = new Set<DayKey>([addDays(today, -1), ...wanted]);
      days.delete(today);
      await Promise.all([...days].map((d) => fetchHours(d, mySeq)));
    } catch (error) {
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, phase: s.phase === "ready" ? "ready" : "error", error: errorText(error) }));
    }
  }

  const scheduleReload = (): void => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      changeTimer = null;
      void reload();
    }, CHANGE_DEBOUNCE_MS);
  };

  async function refresh(): Promise<void> {
    if (refreshInFlight) return refreshInFlight;
    patch((s) => ({ ...s, refreshing: true }));
    refreshInFlight = (async () => {
      try {
        await ctx.usage.refresh();
        await reload();
        const failed = store.get().error;
        patch((s) => ({ ...s, refreshing: false, refreshError: failed }));
        if (failed) throw new Error(failed);
      } catch (error) {
        patch((s) => ({ ...s, refreshing: false, refreshError: errorText(error) }));
        throw error;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  function markRunning(on: boolean): void {
    if (runningTimer) clearTimeout(runningTimer);
    runningTimer = on
      ? setTimeout(() => {
          runningTimer = null;
          patch((s) => ({ ...s, running: false }));
        }, RUNNING_IDLE_MS)
      : null;
    patch((s) => (s.running === on ? s : { ...s, running: on }));
  }

  async function updatePrices(manual: boolean): Promise<void> {
    const at = now();
    patch((s) => ({ ...s, priceUpdate: { ...s.priceUpdate, running: true, error: null } }));
    try {
      const info = await ctx.usage.updatePrices();
      patch((s) => ({
        ...s,
        prices: { phase: "ready", data: info, error: null },
        priceUpdate: { running: false, error: null, lastAttemptAt: at, lastError: null },
      }));
      if (!manual) ctx.storage.set(PRICE_ATTEMPT_KEY, { at, error: null }).catch(() => undefined);
      scheduleReload();
    } catch (error) {
      const message = errorText(error);
      patch((s) => ({
        ...s,
        priceUpdate: { running: false, error: manual ? message : null, lastAttemptAt: at, lastError: manual ? s.priceUpdate.lastError : message },
      }));
      if (!manual) ctx.storage.set(PRICE_ATTEMPT_KEY, { at, error: message }).catch(() => undefined);
      if (manual) throw error;
    }
  }

  const service: UsageService = {
    store,
    reload,
    refresh,
    updatePrices,
    init() {
      ctx.storage
        .get<ChipCache>(CHIP_CACHE_KEY)
        .then((cache) => {
          if (cache && cache.day === store.get().today && typeof cache.tokens === "number") {
            patch((s) => (s.cache ? s : { ...s, cache }));
          }
        })
        .catch(() => undefined);
      void reload();
      void service.loadWorkspaces();
      disposers.push(ctx.usage.onChange(() => scheduleReload()));
      disposers.push(
        ctx.usage.onScanProgress((p) => {
          patch((s) => ({
            ...s,
            progress: p.finished ? null : p,
            progressEngines: p.engine && !s.progressEngines.includes(p.engine) ? [...s.progressEngines, p.engine] : s.progressEngines,
          }));
          if (p.finished) scheduleReload();
        }),
      );
      disposers.push(ctx.events.on("usage://updated", () => markRunning(true)));
      disposers.push(
        ctx.events.on("usage://done", () => {
          markRunning(false);
          if (doneTimer) clearTimeout(doneTimer);
          doneTimer = setTimeout(() => {
            doneTimer = null;
            refresh().catch(() => undefined);
          }, DONE_DEBOUNCE_MS);
        }),
      );
      const tick = setInterval(() => {
        if (todayKey(now()) !== store.get().today) void reload();
      }, DAY_TICK_MS);
      disposers.push(() => clearInterval(tick));
    },
    ensureHours(day) {
      if (!isDayKey(day)) return;
      wanted.add(day);
      const s = store.get();
      if (s.hourly[day] || s.hourlyError[day]) return;
      void fetchHours(day, seq);
    },
    async rescan() {
      if (store.get().rescan.running) return;
      patch((s) => ({ ...s, rescan: { running: true, error: null }, progress: { done: 0, total: 0, engine: null, finished: false }, progressEngines: [] }));
      try {
        await ctx.usage.rescan();
        patch((s) => ({ ...s, rescan: { running: false, error: null }, progress: null }));
        await Promise.all([reload(), service.loadSources()]);
      } catch (error) {
        patch((s) => ({ ...s, rescan: { running: false, error: errorText(error) }, progress: null }));
      }
    },
    async loadSources() {
      patch((s) => ({ ...s, sources: { ...s.sources, phase: "loading", error: null } }));
      try {
        const list = await ctx.usage.sources();
        patch((s) => ({ ...s, sources: { phase: "ready", data: list, error: null } }));
      } catch (error) {
        patch((s) => ({ ...s, sources: { ...s.sources, phase: "error", error: errorText(error) } }));
      }
    },
    async loadPrices() {
      patch((s) => ({ ...s, prices: { ...s.prices, phase: "loading", error: null } }));
      try {
        const info = await ctx.usage.prices();
        patch((s) => ({ ...s, prices: { phase: "ready", data: info, error: null } }));
      } catch (error) {
        patch((s) => ({ ...s, prices: { ...s.prices, phase: "error", error: errorText(error) } }));
      }
    },
    async maybeAutoUpdatePrices(enabled) {
      if (store.get().priceUpdate.running) return;
      const last = await ctx.storage.get<{ at: number; error: string | null }>(PRICE_ATTEMPT_KEY).catch(() => null);
      if (last) {
        patch((s) => ({ ...s, priceUpdate: { ...s.priceUpdate, lastAttemptAt: last.at, lastError: last.error ?? null } }));
      }
      if (disposed || !priceUpdateDue(enabled, last?.at ?? null, now())) return;
      await updatePrices(false);
    },
    async loadWorkspaces() {
      try {
        const list = await ctx.workspaces.list();
        patch((s) => ({ ...s, workspaces: list, workspacesError: null }));
      } catch (error) {
        patch((s) => ({ ...s, workspacesError: errorText(error) }));
      }
    },
    dispose() {
      disposed = true;
      seq += 1;
      for (const t of [doneTimer, changeTimer, runningTimer]) if (t) clearTimeout(t);
      for (const d of disposers.splice(0)) d();
    },
  };
  return service;
}
