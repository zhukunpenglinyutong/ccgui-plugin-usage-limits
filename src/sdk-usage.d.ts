/**
 * Usage / limits capability added to the host as SDK 0.3.23 (permissions
 * `usage.read` / `limits.read`). Kept here verbatim until the shared
 * `src/ccgui-plugin.d.ts` copy is bumped to a version that contains it.
 */
import type { Disposer, PluginContext } from "./ccgui-plugin";

/** Local YYYY-MM-DD, inclusive on both ends; the host fills the timezone. */
export interface UsageStatsQuery {
  from: string;
  to: string;
  bucket?: "day" | "hour";
}

export interface UsageStatRow {
  /** "2026-10-27" (day) or "2026-10-27T14" (hour). */
  bucket: string;
  /** claude | codex | pi | omp (registry is data-driven on the plugin side). */
  engine: string;
  model: string;
  /** Session cwd; null when the log carries none. */
  project: string | null;
  sessions: number;
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Already included in `output`. */
  reasoning: number;
  /** USD estimate; null = no price for this model. */
  cost: number | null;
}

export interface UsageStatsResult {
  rows: UsageStatRow[];
  firstDay: string | null;
  scannedAt: number | null;
  scanning: boolean;
  unknownModels: string[];
}

export interface UsageSourceStatus {
  engine: string;
  label: string;
  roots: string[];
  env: string | null;
  files: number;
  status: "ok" | "missing" | "denied" | "error";
  error: string | null;
  lastScanAt: number | null;
}

export interface UsageScanSummary {
  filesScanned: number;
  eventsAdded: number;
  durationMs: number;
  scannedAt: number;
}

export interface UsageScanProgress {
  done: number;
  total: number;
  engine: string | null;
  finished: boolean;
}

export interface UsagePriceInfo {
  source: "bundled" | "online";
  snapshotDate: string;
  updatedAt: number | null;
  models: number;
}

export type UsageLimitProviderId = "claude" | "codex";

export interface UsageLimitWindow {
  /** five_hour | seven_day | seven_day_opus | seven_day_sonnet | scoped:<model> | session | weekly */
  id: string;
  kind: "session" | "weekly" | "other";
  label: string | null;
  usedPercent: number;
  windowSeconds: number | null;
  /** epoch ms */
  resetsAt: number | null;
}

export interface UsageLimitProvider {
  id: UsageLimitProviderId;
  status: "ok" | "signedOut" | "expired" | "rateLimited" | "offline" | "error";
  plan: string | null;
  /** Last good data is kept on rateLimited / offline. */
  windows: UsageLimitWindow[];
  extra: { usedUsd: number; limitUsd: number } | null;
  fetchedAt: number | null;
  retryAt: number | null;
  error: string | null;
  host: string;
}

export interface UsageLimitsResult {
  providers: UsageLimitProvider[];
}

export interface UsageCaps {
  /** permission usage.read */
  usage: {
    query(q: UsageStatsQuery): Promise<UsageStatsResult>;
    sources(): Promise<UsageSourceStatus[]>;
    /** incremental */
    refresh(): Promise<UsageScanSummary>;
    /** full rebuild (progress via onScanProgress) */
    rescan(): Promise<UsageScanSummary>;
    prices(): Promise<UsagePriceInfo>;
    /** downloads the public LiteLLM price table */
    updatePrices(): Promise<UsagePriceInfo>;
    onChange(cb: (e: { scannedAt: number }) => void): Disposer;
    onScanProgress(cb: (p: UsageScanProgress) => void): Disposer;
  };
  /** permission limits.read */
  limits: {
    get(options?: { providers?: UsageLimitProviderId[]; refresh?: boolean }): Promise<UsageLimitsResult>;
  };
}

export type UsageCtx = PluginContext & UsageCaps;
