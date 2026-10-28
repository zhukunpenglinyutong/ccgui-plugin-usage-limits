/**
 * Persisted preferences (ctx.storage). Everything loaded from storage is
 * untrusted: `sanitizePrefs` keeps only known keys with valid values and
 * falls back to the defaults agreed in the design review.
 */
import type { UsageLimitProviderId } from "../sdk-usage";
import { addDays, type DayKey } from "./dates.ts";
import type { DateRange } from "./periods.ts";

export type ChipMode = "both" | "tokens" | "cost" | "limit";
export type ChipPeriod = "today" | "7d" | "month";
export type AutoRefresh = "5" | "10" | "15" | "30" | "off";

export interface Prefs {
  chipMode: ChipMode;
  chipPeriod: ChipPeriod;
  /** Show the CC GUI brand mark in the status chip / popover (off = line icon). */
  logo: boolean;
  logoMotion: boolean;
  /** Keep every provider's tightest window in the status-bar chip. */
  chipLimits: boolean;
  autoRefresh: AutoRefresh;
  providers: Record<UsageLimitProviderId, boolean>;
  alerts: { on: boolean; thresholds: number[]; background: boolean };
  priceAuto: boolean;
  /** Engines hidden from this plugin's statistics (the host still scans them). */
  excludedEngines: string[];
  /** Collapsed provider cards on the limits page. */
  collapsed: Record<string, boolean>;
  trendBy: "engine" | "model";
  /**
   * Unpriced models whose hero warning was dismissed: sorted model ids joined
   * by ",". A different set (a new unpriced model shows up) warns again.
   */
  ackUnpriced: string;
}

export const THRESHOLD_CHOICES = [70, 80, 90, 95] as const;
export const PROVIDER_IDS: readonly UsageLimitProviderId[] = ["claude", "codex"];
export const BACKGROUND_POLL_MS = 15 * 60_000;
export const PRICE_UPDATE_INTERVAL_MS = 24 * 3_600_000;

export const DEFAULT_PREFS: Prefs = {
  chipMode: "both",
  chipPeriod: "today",
  logo: true,
  logoMotion: true,
  chipLimits: true,
  autoRefresh: "5",
  providers: { claude: true, codex: true },
  alerts: { on: true, thresholds: [80, 95], background: false },
  priceAuto: true,
  excludedEngines: [],
  collapsed: {},
  trendBy: "engine",
  ackUnpriced: "",
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function sanitizeThresholds(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_PREFS.alerts.thresholds];
  const allowed = new Set<number>(THRESHOLD_CHOICES);
  return [...new Set(value.filter((v): v is number => typeof v === "number" && allowed.has(v)))].sort((a, b) => a - b);
}

export function sanitizePrefs(raw: unknown): Prefs {
  if (!isRecord(raw)) return DEFAULT_PREFS;
  const d = DEFAULT_PREFS;
  const providers = isRecord(raw.providers) ? raw.providers : {};
  const alerts = isRecord(raw.alerts) ? raw.alerts : {};
  const collapsed = isRecord(raw.collapsed) ? raw.collapsed : {};
  return {
    chipMode: oneOf(raw.chipMode, ["both", "tokens", "cost", "limit"], d.chipMode),
    chipPeriod: oneOf(raw.chipPeriod, ["today", "7d", "month"], d.chipPeriod),
    logo: bool(raw.logo, d.logo),
    logoMotion: bool(raw.logoMotion, d.logoMotion),
    chipLimits: bool(raw.chipLimits, d.chipLimits),
    autoRefresh: oneOf(raw.autoRefresh, ["5", "10", "15", "30", "off"], d.autoRefresh),
    providers: {
      claude: bool(providers.claude, d.providers.claude),
      codex: bool(providers.codex, d.providers.codex),
    },
    alerts: {
      on: bool(alerts.on, d.alerts.on),
      thresholds: "thresholds" in alerts ? sanitizeThresholds(alerts.thresholds) : [...d.alerts.thresholds],
      background: bool(alerts.background, d.alerts.background),
    },
    priceAuto: bool(raw.priceAuto, d.priceAuto),
    excludedEngines: Array.isArray(raw.excludedEngines)
      ? [...new Set(raw.excludedEngines.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64))]
      : [],
    collapsed: Object.fromEntries(
      Object.entries(collapsed).filter(([k, v]) => typeof v === "boolean" && k.length <= 32),
    ) as Record<string, boolean>,
    trendBy: oneOf(raw.trendBy, ["engine", "model"], d.trendBy),
    ackUnpriced: typeof raw.ackUnpriced === "string" && raw.ackUnpriced.length <= 1024 ? raw.ackUnpriced : "",
  };
}

export function toggleThreshold(list: readonly number[], v: number): number[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);
}

export function toggleInList(list: readonly string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function enabledProviders(prefs: Prefs): UsageLimitProviderId[] {
  return PROVIDER_IDS.filter((id) => prefs.providers[id]);
}

export function autoRefreshMs(value: AutoRefresh): number | null {
  return value === "off" ? null : Number(value) * 60_000;
}

/** At most one automatic price-table download per 24 h (attempts count, success or not). */
export function priceUpdateDue(enabled: boolean, lastAttemptAt: number | null, now: number): boolean {
  if (!enabled) return false;
  if (lastAttemptAt == null || !Number.isFinite(lastAttemptAt)) return true;
  return now - lastAttemptAt >= PRICE_UPDATE_INTERVAL_MS || lastAttemptAt > now;
}

/** Range behind the status-bar number: today / last 7 days / this month. */
export function chipRange(period: ChipPeriod, today: DayKey): DateRange {
  if (period === "7d") return { from: addDays(today, -6), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: today, to: today };
}
