/**
 * Limits service. Network-backed refreshes (`refresh: true`) run while a
 * limits surface is on screen — the popover, the limits page, or the
 * status-bar tags — every N minutes (default 5), or every 15 minutes when the
 * user opted into background checks. A turn ending in the app also pokes a
 * refresh (`poke`, floored at a minute) so the chip follows real usage without
 * anyone clicking it. Everything else reads the host's cached result.
 */
import type { UsageCtx, UsageLimitProvider, UsageLimitProviderId } from "../sdk-usage";
import { mergeProviders } from "../domain/limits.ts";
import { BACKGROUND_POLL_MS } from "../domain/prefs.ts";
import { createStore, errorText, type Store } from "./store.ts";

/** A finished turn must not turn into one vendor request per event. */
const POKE_MIN_MS = 60_000;

export type Surface = "popover" | "page" | "chip";

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
  /** Usage just moved (a turn ended): refresh now, at most once a minute. */
  poke(): void;
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
  let pokeTimer: ReturnType<typeof setTimeout> | null = null;
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
      // Fresh data now: a queued poke would only repeat this call.
      if (pokeTimer) {
        clearTimeout(pokeTimer);
        pokeTimer = null;
      }
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

  /**
   * Usage just moved (a turn reported a chunk / finished): the windows worth
   * showing changed, so refresh instead of waiting for the interval tick. The
   * floor keeps a long turn from becoming one vendor request per event; the
   * host would dedupe at 20 s anyway.
   */
  function poke(): void {
    if (disposed || !config.enabled.length || store.get().fetching) return;
    const { refreshedAt } = store.get();
    const wait = refreshedAt == null ? 0 : refreshedAt + POKE_MIN_MS - now();
    if (wait <= 0) {
      fetch(true).catch(() => undefined);
      return;
    }
    if (pokeTimer) return;
    pokeTimer = setTimeout(() => {
      pokeTimer = null;
      fetch(true).catch(() => undefined);
    }, wait);
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
    poke,
    dispose() {
      disposed = true;
      seq += 1;
      if (timer) clearInterval(timer);
      if (retryTimer) clearTimeout(retryTimer);
      if (pokeTimer) {
        clearTimeout(pokeTimer);
        pokeTimer = null;
      }
      timer = null;
      retryTimer = null;
    },
  };
}
