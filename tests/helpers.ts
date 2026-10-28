import type { UsageStatRow, UsageLimitWindow, UsageLimitProvider } from "../src/sdk-usage";

export function row(over: Partial<UsageStatRow> = {}): UsageStatRow {
  return {
    bucket: "2026-10-27",
    engine: "claude",
    model: "claude-opus",
    project: "/work/app",
    sessions: 1,
    requests: 2,
    input: 100,
    output: 50,
    cacheRead: 800,
    cacheWrite: 50,
    reasoning: 10,
    cost: 1,
    ...over,
  };
}

export function win(over: Partial<UsageLimitWindow> = {}): UsageLimitWindow {
  return { id: "five_hour", kind: "session", label: null, usedPercent: 50, windowSeconds: 5 * 3600, resetsAt: null, ...over };
}

export function provider(over: Partial<UsageLimitProvider> = {}): UsageLimitProvider {
  return {
    id: "claude",
    status: "ok",
    plan: "Max 20x",
    windows: [],
    extra: null,
    fetchedAt: 0,
    retryAt: null,
    error: null,
    host: "api.anthropic.com",
    ...over,
  };
}
