/**
 * Limits service. Network-backed refreshes (`refresh: true`) only run while
 * the popover or the limits page is visible (every N minutes, default 5),
 * or every 15 minutes when the user opted into background checks. Startup
 * and visibility changes read the host's cached result (`refresh: false`).
 */
import type { UsageCtx, UsageLimitProvider, UsageLimitProviderId } from "../sdk-usage";
import { mergeProviders } from "../domain/limits.ts";
import { BACKGROUND_POLL_MS } from "../domain/prefs.ts";
import { createStore, errorText, type Store } from "./store.ts";

export type Surface = "popover" | "page";

export interface LimitsState {
  phase: "idle" | "loading" | "ready" | "error";
  providers: UsageLimitProvider[];
  error: string | null;
  fetching: boolean;
  retrying: Partial<Record<UsageLimitProviderId, boolean>>;
  /** Last successful network refresh (refresh: true), epoch ms. */
  refreshedAt: number | null;
}

export interface LimitsConfig {
  enabled: UsageLimitProviderId[];
  /** Interval while visible; null = auto refresh off. */
  visibleMs: number | null;
  background: boolean;
}

export interface LimitsService {
  store: Store<LimitsState>;
  fetch(refresh: boolean): Promise<void>;
  retry(id: UsageLimitProviderId): Promise<void>;
  setVisible(surface: Surface, visible: boolean): void;
  configure(config: LimitsConfig): void;
  dispose(): void;
}

export function createLimitsService(opts: { ctx: UsageCtx; now?: () => number; config: LimitsConfig }): LimitsService {
  const { ctx } = opts;
  const now = opts.now ?? (() => Date.now());
  const store = createStore<LimitsState>({ phase: "idle", providers: [], error: null, fetching: false, retrying: {}, refreshedAt: null });
  const visible = new Set<Surface>();
  let config = opts.config;
  let timer: ReturnType<typeof setInterval> | null = null;
  let timerMs: number | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let disposed = false;

  const patch = (fn: (s: LimitsState) => LimitsState): void => {
    if (!disposed) store.set(fn);
  };

  async function fetch(refresh: boolean): Promise<void> {
    if (!config.enabled.length) {
      patch((s) => ({ ...s, phase: "ready", providers: [], error: null, fetching: false }));
      return;
    }
    seq += 1;
    const mySeq = seq;
    patch((s) => ({ ...s, fetching: true, phase: s.phase === "idle" ? "loading" : s.phase }));
    try {
      const res = await ctx.limits.get({ providers: config.enabled, refresh });
      if (mySeq !== seq) return;
      patch((s) => ({
        ...s,
        phase: "ready",
        providers: res.providers.filter((p) => config.enabled.includes(p.id)),
        error: null,
        fetching: false,
        refreshedAt: refresh ? now() : s.refreshedAt,
      }));
      scheduleRetry();
    } catch (error) {
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, phase: s.providers.length ? "ready" : "error", error: errorText(error), fetching: false }));
      throw error;
    }
  }

  /** Rate-limited providers carry retryAt: re-query once it passes (while a limits surface is visible). */
  function scheduleRetry(): void {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (!visible.size) return;
    const at = store
      .get()
      .providers.filter((p) => p.status === "rateLimited" && p.retryAt != null)
      .reduce<number | null>((min, p) => (min == null || (p.retryAt as number) < min ? (p.retryAt as number) : min), null);
    if (at == null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      fetch(true).catch(() => undefined);
    }, Math.max(1000, at - now() + 500));
  }

  function intervalMs(): number | null {
    if (visible.size > 0) return config.visibleMs;
    return config.background ? BACKGROUND_POLL_MS : null;
  }

  function reschedule(): void {
    const ms = intervalMs();
    if (ms === timerMs) return;
    if (timer) clearInterval(timer);
    timer = null;
    timerMs = ms;
    if (ms != null) timer = setInterval(() => void fetch(true).catch(() => undefined), ms);
  }

  return {
    store,
    fetch,
    async retry(id) {
      patch((s) => ({ ...s, retrying: { ...s.retrying, [id]: true } }));
      try {
        const res = await ctx.limits.get({ providers: [id], refresh: true });
        patch((s) => ({
          ...s,
          providers: mergeProviders(s.providers, res.providers.filter((p) => p.id === id)),
          retrying: { ...s.retrying, [id]: false },
        }));
      } catch (error) {
        patch((s) => ({ ...s, retrying: { ...s.retrying, [id]: false }, error: errorText(error) }));
        throw error;
      }
    },
    setVisible(surface, on) {
      const was = visible.size > 0;
      if (on) visible.add(surface);
      else visible.delete(surface);
      reschedule();
      scheduleRetry();
      if (on && !was) {
        const { refreshedAt } = store.get();
        const stale = config.visibleMs != null && (refreshedAt == null || now() - refreshedAt >= config.visibleMs);
        fetch(stale).catch(() => undefined);
      }
    },
    configure(next) {
      const providersChanged = next.enabled.join() !== config.enabled.join();
      config = next;
      // Restart the timer so a changed interval takes effect immediately.
      if (timer) clearInterval(timer);
      timer = null;
      timerMs = null;
      reschedule();
      if (providersChanged) fetch(false).catch(() => undefined);
    },
    dispose() {
      disposed = true;
      seq += 1;
      if (timer) clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      timer = null;
      retryTimer = null;
    },
  };
}
