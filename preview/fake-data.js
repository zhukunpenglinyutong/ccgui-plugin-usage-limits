/**
 * Deterministic fake data for the preview harness only (never shipped).
 * Shapes follow the SDK 0.3.23 usage/limits types; numbers are seeded so
 * screenshots are reproducible. Prices are illustrative, not vendor quotes.
 */

const DAY = 86_400_000;
const H = 3_600_000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k, n) => {
  const d = fromKey(k);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

const ROOT = "/Users/me/projects";
export const WORKSPACES = [
  { id: "w-ccgui", name: "desktop-cc-gui", path: `${ROOT}/desktop-cc-gui`, groupId: null, lastOpenedAt: 1 },
  { id: "w-wt", name: "pr-1455-922", path: `${ROOT}/desktop-cc-gui-worktrees/pr-1455-922`, kind: "worktree", parentId: "w-ccgui", groupId: null, lastOpenedAt: 1, worktree: { branch: "pr-1455" } },
  { id: "w-jb", name: "jetbrains-cc-gui", path: `${ROOT}/jetbrains-cc-gui`, groupId: null, lastOpenedAt: 1 },
  { id: "w-plugins", name: "CCGUI 插件", path: `${ROOT}/CCGUI 插件`, groupId: null, lastOpenedAt: 1 },
];

const PROJECTS = [
  [`${ROOT}/desktop-cc-gui`, 0.34],
  [`${ROOT}/desktop-cc-gui/src-tauri`, 0.12],
  [`${ROOT}/desktop-cc-gui-worktrees/pr-1455-922`, 0.08],
  [`${ROOT}/jetbrains-cc-gui`, 0.16],
  [`${ROOT}/CCGUI 插件/ccgui-plugin-usage-limits`, 0.18],
  ["/private/tmp/scratch", 0.08],
  [null, 0.04],
];

const ENGINE_MODELS = {
  omp: [["deepseek-v4-flash", 0.6], ["kimi-k3", 0.2], ["claude-sonnet-5-5", 0.12], ["gpt-5.5", 0.08]],
  pi: [["deepseek-flash", 0.84], ["kimi-k3-turbo", 0.16]],
  claude: [["claude-opus-5-5[1m]", 0.8], ["claude-fable-5-1", 0.12], ["claude-haiku-5-5", 0.08]],
  codex: [["gpt-5.5-codex", 0.72], ["gpt-5.5-mini", 0.28]],
};

/** USD per million tokens [input, output, cacheRead, cacheWrite]; null = no price. */
const PRICES = {
  "claude-opus-5-5[1m]": [5, 25, 0.5, 6.25],
  "claude-fable-5-1": [15, 75, 1.5, 18.75],
  "claude-sonnet-5-5": [3, 15, 0.3, 3.75],
  "claude-haiku-5-5": [1, 5, 0.1, 1.25],
  "gpt-5.5": [1.25, 10, 0.125, 0],
  "gpt-5.5-codex": [1.25, 10, 0.125, 0],
  "gpt-5.5-mini": [0.25, 2, 0.025, 0],
  "deepseek-v4-flash": [0.14, 0.28, 0.014, 0],
  "deepseek-flash": [0.14, 0.28, 0.014, 0],
  "kimi-k3": null,
  "kimi-k3-turbo": null,
};

const HOUR_SHAPE = [0.18, 0.1, 0.05, 0.03, 0.02, 0.02, 0.04, 0.12, 0.35, 0.75, 1, 0.95, 0.6, 0.75, 1, 1, 0.92, 0.85, 0.6, 0.7, 0.9, 0.85, 0.62, 0.38];

function engineMix(t, total) {
  const f = t / Math.max(1, total);
  if (f < 0.4) return { claude: 0.64, codex: 0.22, pi: 0.14 };
  if (f < 0.75) return { claude: 0.42, omp: 0.28, pi: 0.18, codex: 0.12 };
  return { omp: 0.46, pi: 0.3, claude: 0.2, codex: 0.04 };
}

function pickWeighted(list, r) {
  let acc = 0;
  for (const [item, w] of list) {
    acc += w;
    if (r <= acc) return item;
  }
  return list[list.length - 1][0];
}

function cost(model, r) {
  const p = PRICES[model];
  if (!p) return null;
  return (p[0] * r.input + p[1] * r.output + p[2] * r.cacheRead + p[3] * r.cacheWrite) / 1e6;
}

function split(total, rand) {
  const cacheRead = Math.round(total * (0.88 + rand() * 0.07));
  const rest = total - cacheRead;
  const input = Math.round(rest * 0.36);
  const output = Math.round(rest * 0.21);
  const cacheWrite = Math.max(0, rest - input - output);
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning: Math.round(output * (0.2 + rand() * 0.25)),
    requests: Math.max(1, Math.round(total / (140e3 + rand() * 90e3))),
    sessions: 1,
  };
}

function hourWeights(day, today, nowHour) {
  const r = mulberry32(day.split("-").join("") * 7);
  return HOUR_SHAPE.map((v, h) => (day === today && h > nowHour ? 0 : v * (0.5 + r())));
}

/** Builds day rows + an hour expander for one scenario. */
export function buildUsage({ now = Date.now(), historyDays = 170, empty = false } = {}) {
  const today = keyOf(new Date(now));
  const nowHour = new Date(now).getHours();
  const firstDay = empty ? null : addDays(today, -(historyDays - 1));
  const rand = mulberry32(20261027);
  const dayRows = [];
  if (!empty) {
    for (let t = 0; t < historyDays; t += 1) {
      const day = addDays(firstDay, t);
      const isToday = day === today;
      const dow = fromKey(day).getDay();
      if (!isToday && t > 0 && rand() < (t < 40 ? 0.25 : 0.07)) continue;
      const scale = 25e6 * Math.exp((t / historyDays) * 2.6) * (dow === 0 || dow === 6 ? 0.5 : 1) * (0.55 + rand() * 0.9);
      const weights = hourWeights(day, today, nowHour);
      const dayShare = isToday ? weights.reduce((a, b) => a + b, 0) / HOUR_SHAPE.reduce((a, b) => a + b, 0) : 1;
      for (const [engine, share] of Object.entries(engineMix(t, historyDays))) {
        for (const [model, mShare] of ENGINE_MODELS[engine]) {
          const total = scale * dayShare * share * mShare * (0.75 + rand() * 0.5);
          if (total < 5000) continue;
          const project = pickWeighted(PROJECTS, rand());
          const base = split(Math.round(total), rand);
          dayRows.push({ bucket: day, engine, model, project, ...base, cost: cost(model, base) });
        }
      }
    }
  }

  function hourRows(day) {
    const weights = hourWeights(day, today, nowHour);
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const out = [];
    for (const r of dayRows) {
      if (r.bucket !== day) continue;
      weights.forEach((w, h) => {
        if (w <= 0) return;
        const f = w / sum;
        const part = {
          input: Math.round(r.input * f),
          output: Math.round(r.output * f),
          cacheRead: Math.round(r.cacheRead * f),
          cacheWrite: Math.round(r.cacheWrite * f),
          reasoning: Math.round(r.reasoning * f),
          requests: Math.max(0, Math.round(r.requests * f)),
          sessions: h === 10 ? 1 : 0,
        };
        out.push({ ...r, bucket: `${day}T${pad(h)}`, ...part, cost: r.cost == null ? null : r.cost * f });
      });
    }
    return out;
  }

  const unknownModels = [...new Set(dayRows.filter((r) => r.cost == null).map((r) => r.model))].sort();
  return { today, firstDay, dayRows, hourRows, unknownModels };
}

const win = (id, kind, label, usedPercent, windowSeconds, resetInMs, now) => ({
  id,
  kind,
  label,
  usedPercent,
  windowSeconds,
  resetsAt: resetInMs == null ? null : now + resetInMs,
});

export function buildLimits({ now = Date.now(), claude = "ok", codex = "ok", tight = false } = {}) {
  const claudeOk = {
    id: "claude",
    status: "ok",
    plan: "Max 20x",
    windows: [
      win("five_hour", "session", null, tight ? 86 : 52, 5 * 3600, tight ? 185 * 60_000 : 72 * 60_000, now),
      win("seven_day", "weekly", null, 37, 7 * 86400, 28 * H, now),
      win("scoped:claude-fable-5-1", "other", "Fable", 2, 7 * 86400, 28 * H, now),
    ],
    extra: { usedUsd: 12.4, limitUsd: 50 },
    fetchedAt: now - 2 * 60_000,
    retryAt: null,
    error: null,
    host: "api.anthropic.com",
  };
  const codexOk = {
    id: "codex",
    status: "ok",
    plan: "Pro",
    windows: [win("session", "session", null, 8, 5 * 3600, 242 * 60_000, now), win("weekly", "weekly", null, 71, 7 * 86400, 51 * H, now)],
    extra: null,
    fetchedAt: now - 2 * 60_000,
    retryAt: null,
    error: null,
    host: "chatgpt.com",
  };
  const apply = (base, status) => {
    switch (status) {
      case "signedOut":
        return { ...base, status, plan: null, windows: [], extra: null, fetchedAt: null };
      case "expired":
        return { ...base, status, windows: [], extra: null, fetchedAt: null };
      case "rateLimited":
        return { ...base, status, fetchedAt: now - 6 * 60_000, retryAt: now + 2 * 60_000 };
      case "offline":
        return { ...base, status, fetchedAt: now - 25 * 60_000, error: "error sending request" };
      case "error":
        return { ...base, status, windows: [], extra: null, error: "HTTP 403" };
      case "weekly":
        return { ...base, plan: "Free", windows: [win("weekly", "weekly", null, 46, 7 * 86400, 78 * H, now)] };
      default:
        return base;
    }
  };
  return { providers: [apply(claudeOk, claude), apply(codexOk, codex)] };
}

export const SOURCES = [
  { engine: "claude", label: "Claude Code", roots: ["~/.claude/projects"], env: "CLAUDE_CONFIG_DIR", files: 1284, status: "ok", error: null },
  { engine: "omp", label: "oh-my-pi", roots: ["~/.omp/agent/sessions"], env: null, files: 2210, status: "ok", error: null },
  { engine: "pi", label: "Pi", roots: ["~/.pi/agent/sessions"], env: null, files: 861, status: "ok", error: null },
  { engine: "codex", label: "Codex", roots: ["~/.codex/sessions", "~/.codex/archived_sessions"], env: "CODEX_HOME", files: 37, status: "ok", error: null },
];

export { DAY, H };
