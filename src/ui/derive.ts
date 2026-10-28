/** Store-backed derived values shared by several surfaces. */
import { useMemo } from "react";
import { filterRows, sumRows, type Totals } from "../domain/aggregate.ts";
import { limitAlert, providerTags, type LimitAlert, type ProviderTag } from "../domain/limits.ts";
import { chipRange, enabledProviders, type Prefs } from "../domain/prefs.ts";
import type { LimitsState } from "../data/limits.ts";
import type { UsageState } from "../data/usage.ts";
import type { App } from "./app.tsx";
import { useStore } from "./hooks.ts";

export function useAll(app: App) {
  const prefsState = useStore(app.prefs.store);
  const usage = useStore(app.usage.store);
  const limits = useStore(app.limits.store);
  return { prefs: prefsState.prefs, prefsState, usage, limits };
}

export function computeAlert(prefs: Prefs, limits: LimitsState): LimitAlert | null {
  return limitAlert(limits.providers, enabledProviders(prefs), prefs.alerts);
}

export function useAlert(prefs: Prefs, limits: LimitsState): LimitAlert | null {
  return useMemo(() => computeAlert(prefs, limits), [prefs, limits]);
}

/** Per-provider status-bar tags: 5-hour + weekly window for each enabled provider. */
export function useProviderTags(prefs: Prefs, limits: LimitsState): ProviderTag[] {
  return useMemo(() => providerTags(limits.providers, enabledProviders(prefs), prefs.alerts), [prefs, limits]);
}

/** Status-bar number: live data once loaded, otherwise the cached value from the last session. */
export function useChipTotals(prefs: Prefs, usage: UsageState): Pick<Totals, "total" | "cost"> | null {
  return useMemo(() => {
    if (usage.phase === "ready") {
      const range = chipRange(prefs.chipPeriod, usage.today);
      const sum = sumRows(filterRows(usage.daily, { ...range, excluded: prefs.excludedEngines }));
      return { total: sum.total, cost: sum.cost };
    }
    const c = usage.cache;
    return c && c.period === prefs.chipPeriod ? { total: c.tokens, cost: c.cost } : null;
  }, [prefs.chipPeriod, prefs.excludedEngines, usage.phase, usage.daily, usage.today, usage.cache]);
}

export function scanPct(usage: UsageState): number {
  const p = usage.progress;
  return p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
}

/** True when no usage exists at all (host answered, nothing recorded). */
export function isEmpty(usage: UsageState): boolean {
  return usage.phase === "ready" && !usage.scanning && !usage.firstDay;
}

/** A refresh only counts as successful when every enabled provider answered. */
export function anyProviderFailed(limits: LimitsState): boolean {
  return limits.providers.some((p) => p.status === "offline" || p.status === "rateLimited" || p.status === "error");
}
