/**
 * Subscription limit windows: labels, bar colors, pace / run-out projection
 * and the alert threshold logic behind the status-bar tag + sidebar badge.
 *
 * Pace: the tick on a bar is *time progress* (how far through the window we
 * are). Extrapolating the average burn rate to the reset tells whether the
 * window lasts ("ok", projected % at reset) or runs out early ("over", with
 * the time left and how much earlier than the reset).
 */
import type { UsageLimitProvider, UsageLimitProviderId, UsageLimitWindow } from "../sdk-usage";

export type BarLevel = "ok" | "warn" | "danger";
export type AlertLevel = "warn" | "danger";

export const FIVE_HOURS_S = 5 * 3600;
export const SEVEN_DAYS_S = 7 * 86400;
/** Below this share of elapsed window time no projection is made. */
export const EARLY_WINDOW = 0.03;

export function barLevel(usedPercent: number): BarLevel {
  if (usedPercent >= 90) return "danger";
  if (usedPercent >= 70) return "warn";
  return "ok";
}

export const clampPct = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

export type Pace =
  | { kind: "unknown" | "idle"; marker: null }
  | { kind: "early"; marker: number }
  | { kind: "ok"; marker: number; projected: number }
  | { kind: "exhausted"; marker: number }
  | { kind: "over"; marker: number; projected: number; runOutMs: number; earlyMs: number };

export function windowSeconds(w: UsageLimitWindow): number | null {
  if (w.windowSeconds != null && w.windowSeconds > 0) return w.windowSeconds;
  if (w.id === "five_hour" || w.id === "session") return FIVE_HOURS_S;
  if (w.id.startsWith("seven_day") || w.id === "weekly" || w.id.startsWith("scoped:")) return SEVEN_DAYS_S;
  return null;
}

export function pace(w: UsageLimitWindow, now: number): Pace {
  const seconds = windowSeconds(w);
  if (seconds == null || w.resetsAt == null) return { kind: "unknown", marker: null };
  const windowMs = seconds * 1000;
  const remaining = Math.max(0, w.resetsAt - now);
  const elapsed = Math.min(Math.max(1 - remaining / windowMs, 0), 1);
  const used = Math.max(0, w.usedPercent) / 100;
  if (used <= 0) return { kind: "idle", marker: null };
  if (used >= 1) return { kind: "exhausted", marker: elapsed };
  if (elapsed < EARLY_WINDOW) return { kind: "early", marker: elapsed };
  const projected = used / elapsed;
  if (projected < 1) return { kind: "ok", marker: elapsed, projected };
  const ratePerMs = used / (elapsed * windowMs);
  const runOutMs = (1 - used) / ratePerMs;
  return { kind: "over", marker: elapsed, projected, runOutMs, earlyMs: Math.max(0, remaining - runOutMs) };
}

export interface WindowInfo {
  /** Duration of the window, e.g. { unit: "h", n: 5 } or { unit: "d", n: 7 }. */
  span: { unit: "h" | "d"; n: number } | null;
  /** Codex-style "weekly" naming rather than a "7 days" span. */
  weekly: boolean;
  /** Model name for model-scoped weekly windows (Claude Opus / Sonnet / …). */
  model: string | null;
  /** Compact label used in the popover rows and the status tag ("5h", "7d", "Fable"). */
  short: string;
}

const titleCase = (s: string): string => s.replace(/(^|[\s_-])([a-z])/g, (_, p: string, c: string) => `${p === "_" ? " " : p}${c.toUpperCase()}`);

export function isScopedWindow(w: UsageLimitWindow): boolean {
  return w.id.startsWith("seven_day_") || w.id.startsWith("scoped:");
}

export function scopedModelName(w: UsageLimitWindow): string {
  if (w.label && w.label.trim()) return w.label.trim();
  if (w.id.startsWith("scoped:")) return w.id.slice("scoped:".length) || w.id;
  return titleCase(w.id.slice("seven_day_".length));
}

export function windowInfo(w: UsageLimitWindow): WindowInfo {
  const seconds = windowSeconds(w);
  const span =
    seconds == null
      ? null
      : seconds >= 86400 && seconds % 86400 === 0
        ? { unit: "d" as const, n: seconds / 86400 }
        : { unit: "h" as const, n: Math.max(1, Math.round(seconds / 3600)) };
  const model = isScopedWindow(w) ? scopedModelName(w) : null;
  const weekly = !model && (w.id === "weekly" || (w.kind === "weekly" && !w.id.startsWith("seven_day")));
  const short = model ?? (span ? `${span.n}${span.unit}` : (w.label ?? w.id));
  return { span, weekly, model, short };
}

export const hasWindows = (p: UsageLimitProvider): boolean =>
  (p.status === "ok" || p.status === "rateLimited" || p.status === "offline") && p.windows.length > 0;

export const isStale = (p: UsageLimitProvider): boolean => p.status === "rateLimited" || p.status === "offline";

/** CLI command a signed-out / expired user runs in a terminal (the plugin never logs in for them). */
export function loginCommand(id: UsageLimitProviderId): string {
  return id === "codex" ? "codex login" : "claude";
}

/** Codex free plans only have a weekly window; the limits page says so. */
export function isWeeklyOnly(p: UsageLimitProvider): boolean {
  if (p.windows.length !== 1) return false;
  const info = windowInfo(p.windows[0]);
  return info.weekly || (info.span?.unit === "d" && info.span.n === 7);
}

export interface AlertPrefs {
  on: boolean;
  thresholds: readonly number[];
}

/** Warn at the lowest threshold; danger at the highest (or 95% with a single threshold). */
export function alertLevel(pct: number, prefs: AlertPrefs): AlertLevel | null {
  if (!prefs.on || !prefs.thresholds.length) return null;
  const sorted = [...prefs.thresholds].sort((a, b) => a - b);
  const warnAt = sorted[0];
  const dangerAt = sorted.length >= 2 ? sorted[sorted.length - 1] : Math.max(95, warnAt);
  if (pct >= dangerAt) return "danger";
  if (pct >= warnAt) return "warn";
  return null;
}

export interface TopWindow {
  provider: UsageLimitProviderId;
  window: UsageLimitWindow;
  pct: number;
}

/** The provider's own tightest window (highest used %). */
function topOf(p: UsageLimitProvider): TopWindow | null {
  let top: TopWindow | null = null;
  for (const w of p.windows) {
    const pct = clampPct(w.usedPercent);
    if (!top || pct > top.pct) top = { provider: p.id, window: w, pct };
  }
  return top;
}

export interface LimitAlert extends TopWindow {
  level: AlertLevel | null;
}

/**
 * One status-bar tag per enabled provider: that provider's tightest window,
 * in the user's provider order. Always returned (alert level is null below the
 * thresholds) so the chip can show every provider's headroom, not only the
 * ones on fire.
 */
export function providerTops(
  providers: readonly UsageLimitProvider[],
  enabled: readonly UsageLimitProviderId[],
  prefs: AlertPrefs,
): LimitAlert[] {
  const tops: LimitAlert[] = [];
  // Follow the user's provider order (claude, codex) so a tag never jumps
  // position just because another provider's number crossed it.
  for (const id of enabled) {
    const p = providers.find((q) => q.id === id);
    if (!p || !hasWindows(p)) continue;
    const top = topOf(p);
    if (top) tops.push({ ...top, level: alertLevel(top.pct, prefs) });
  }
  return tops;
}

export interface WindowUse {
  window: UsageLimitWindow;
  pct: number;
}

export interface ProviderTag {
  provider: UsageLimitProviderId;
  /** Windows shown side by side in the status bar: 5-hour + weekly. */
  windows: WindowUse[];
  /** Highest share among them; drives the tag colour. */
  pct: number;
  level: AlertLevel | null;
}

/**
 * Status-bar content per provider: its 5-hour and weekly windows side by side
 * (model-scoped windows such as Opus / Fable stay on the limits page). A
 * provider that has neither falls back to its tightest window, so a weekly-only
 * free plan still gets a tag.
 */
export function providerTags(
  providers: readonly UsageLimitProvider[],
  enabled: readonly UsageLimitProviderId[],
  prefs: AlertPrefs,
): ProviderTag[] {
  const tags: ProviderTag[] = [];
  for (const id of enabled) {
    const p = providers.find((q) => q.id === id);
    if (!p || !hasWindows(p)) continue;
    const session = p.windows.find((w) => w.kind === "session" && !isScopedWindow(w));
    const weekly = p.windows.find((w) => w.kind === "weekly" && !isScopedWindow(w));
    const picked = [session, weekly].filter((w): w is UsageLimitWindow => w != null);
    const top = topOf(p);
    const shown = picked.length ? picked : top ? [top.window] : [];
    if (!shown.length) continue;
    const windows = shown.map((w) => ({ window: w, pct: clampPct(w.usedPercent) }));
    const pct = Math.max(...windows.map((x) => x.pct));
    tags.push({ provider: p.id, windows, pct, level: alertLevel(pct, prefs) });
  }
  return tags;
}

/** The single tightest window across providers (sidebar badge, popover bubble). */
export function limitAlert(
  providers: readonly UsageLimitProvider[],
  enabled: readonly UsageLimitProviderId[],
  prefs: AlertPrefs,
): LimitAlert | null {
  let top: LimitAlert | null = null;
  for (const t of providerTops(providers, enabled, prefs)) if (!top || t.pct > top.pct) top = t;
  return top;
}

/** Bar fill / tick positions: fill = used %, tick = elapsed share of the window. */
export function barGeometry(usedPercent: number, marker: number | null) {
  return { used: clampPct(usedPercent), tick: marker == null ? null : marker * 100 };
}

/** Merge a refreshed subset of providers into the previous result immutably. */
export function mergeProviders(
  prev: readonly UsageLimitProvider[],
  next: readonly UsageLimitProvider[],
): UsageLimitProvider[] {
  const byId = new Map(next.map((p) => [p.id, p]));
  const merged = prev.map((p) => byId.get(p.id) ?? p);
  const missing = next.filter((p) => !prev.some((q) => q.id === p.id));
  return [...merged, ...missing];
}
