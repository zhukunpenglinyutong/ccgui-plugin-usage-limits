/* usage-limits · built from src/ by scripts/build.mjs — do not edit by hand */

// src/shim/react.ts
var bound = null;
function bindReact(instance) {
  if (!instance || typeof instance.createElement !== "function") {
    throw new Error("bindReact: expected the host React instance (ctx.react)");
  }
  bound = instance;
}
function unboundError(name) {
  return new Error(
    `React.${name}() was called before bindReact(ctx.react); call bindReact first thing in activate().`
  );
}
function host(name) {
  if (!bound) throw unboundError(name);
  const fn = bound[name];
  if (typeof fn !== "function") {
    throw new Error(`The host React instance has no ${name}()`);
  }
  return fn;
}
var forward = (name) => (...args) => host(name)(...args);
var REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for("react.forward_ref");
var Fragment = /* @__PURE__ */ Symbol.for("react.fragment");
function forwardRef(render) {
  if (typeof render !== "function") {
    throw new Error("forwardRef requires a render function");
  }
  return { $$typeof: REACT_FORWARD_REF_TYPE, render };
}
var createElement = forward("createElement");
var cloneElement = forward("cloneElement");
var isValidElement = forward("isValidElement");
var createContext = forward("createContext");
var createRef = forward("createRef");
var startTransition = forward("startTransition");
var lazy = forward("lazy");
var useState = forward("useState");
var useEffect = forward("useEffect");
var useLayoutEffect = forward("useLayoutEffect");
var useInsertionEffect = forward("useInsertionEffect");
var useMemo = forward("useMemo");
var useCallback = forward("useCallback");
var useRef = forward("useRef");
var useReducer = forward("useReducer");
var useContext = forward("useContext");
var useId = forward("useId");
var useImperativeHandle = forward("useImperativeHandle");
var useSyncExternalStore = forward("useSyncExternalStore");
var useTransition = forward("useTransition");
var useDeferredValue = forward("useDeferredValue");
var useDebugValue = forward("useDebugValue");
function children(name) {
  return (...args) => {
    if (!bound) throw unboundError(`Children.${name}`);
    const fn = bound.Children?.[name];
    if (typeof fn !== "function") throw new Error(`The host React instance has no Children.${name}()`);
    return fn(...args);
  };
}
var Children = {
  map: children("map"),
  forEach: children("forEach"),
  count: children("count"),
  toArray: children("toArray"),
  only: children("only")
};

// src/domain/limits.ts
var FIVE_HOURS_S = 5 * 3600;
var SEVEN_DAYS_S = 7 * 86400;
var EARLY_WINDOW = 0.03;
function barLevel(usedPercent) {
  if (usedPercent >= 90) return "danger";
  if (usedPercent >= 70) return "warn";
  return "ok";
}
var clampPct = (v) => Math.min(100, Math.max(0, Math.round(v)));
function windowSeconds(w) {
  if (w.windowSeconds != null && w.windowSeconds > 0) return w.windowSeconds;
  if (w.id === "five_hour" || w.id === "session") return FIVE_HOURS_S;
  if (w.id.startsWith("seven_day") || w.id === "weekly" || w.id.startsWith("scoped:")) return SEVEN_DAYS_S;
  return null;
}
function pace(w, now) {
  const seconds = windowSeconds(w);
  if (seconds == null || w.resetsAt == null) return { kind: "unknown", marker: null };
  const windowMs = seconds * 1e3;
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
var titleCase = (s) => s.replace(/(^|[\s_-])([a-z])/g, (_, p2, c) => `${p2 === "_" ? " " : p2}${c.toUpperCase()}`);
function isScopedWindow(w) {
  return w.id.startsWith("seven_day_") || w.id.startsWith("scoped:");
}
function scopedModelName(w) {
  if (w.label && w.label.trim()) return w.label.trim();
  if (w.id.startsWith("scoped:")) return w.id.slice("scoped:".length) || w.id;
  return titleCase(w.id.slice("seven_day_".length));
}
function windowInfo(w) {
  const seconds = windowSeconds(w);
  const span = seconds == null ? null : seconds >= 86400 && seconds % 86400 === 0 ? { unit: "d", n: seconds / 86400 } : { unit: "h", n: Math.max(1, Math.round(seconds / 3600)) };
  const model = isScopedWindow(w) ? scopedModelName(w) : null;
  const weekly = !model && (w.id === "weekly" || w.kind === "weekly" && !w.id.startsWith("seven_day"));
  const short = model ?? (span ? `${span.n}${span.unit}` : w.label ?? w.id);
  return { span, weekly, model, short };
}
var hasWindows = (p2) => (p2.status === "ok" || p2.status === "rateLimited" || p2.status === "offline") && p2.windows.length > 0;
var isStale = (p2) => p2.status === "rateLimited" || p2.status === "offline";
function loginCommand(id) {
  return id === "codex" ? "codex login" : "claude";
}
function isWeeklyOnly(p2) {
  if (p2.windows.length !== 1) return false;
  const info = windowInfo(p2.windows[0]);
  return info.weekly || info.span?.unit === "d" && info.span.n === 7;
}
function alertLevel(pct2, prefs) {
  if (!prefs.on || !prefs.thresholds.length) return null;
  const sorted = [...prefs.thresholds].sort((a, b) => a - b);
  const warnAt = sorted[0];
  const dangerAt = sorted.length >= 2 ? sorted[sorted.length - 1] : Math.max(95, warnAt);
  if (pct2 >= dangerAt) return "danger";
  if (pct2 >= warnAt) return "warn";
  return null;
}
function topOf(p2) {
  let top = null;
  for (const w of p2.windows) {
    const pct2 = clampPct(w.usedPercent);
    if (!top || pct2 > top.pct) top = { provider: p2.id, window: w, pct: pct2 };
  }
  return top;
}
function providerTops(providers, enabled, prefs) {
  const tops = [];
  for (const id of enabled) {
    const p2 = providers.find((q) => q.id === id);
    if (!p2 || !hasWindows(p2)) continue;
    const top = topOf(p2);
    if (top) tops.push({ ...top, level: alertLevel(top.pct, prefs) });
  }
  return tops;
}
function providerTags(providers, enabled, prefs) {
  const tags = [];
  for (const id of enabled) {
    const p2 = providers.find((q) => q.id === id);
    if (!p2 || !hasWindows(p2)) continue;
    const session = p2.windows.find((w) => w.kind === "session" && !isScopedWindow(w));
    const weekly = p2.windows.find((w) => w.kind === "weekly" && !isScopedWindow(w));
    const picked = [session, weekly].filter((w) => w != null);
    const top = topOf(p2);
    const shown = picked.length ? picked : top ? [top.window] : [];
    if (!shown.length) continue;
    const windows = shown.map((w) => ({ window: w, pct: clampPct(w.usedPercent) }));
    const pct2 = Math.max(...windows.map((x) => x.pct));
    tags.push({ provider: p2.id, windows, pct: pct2, level: alertLevel(pct2, prefs) });
  }
  return tags;
}
function limitAlert(providers, enabled, prefs) {
  let top = null;
  for (const t of providerTops(providers, enabled, prefs)) if (!top || t.pct > top.pct) top = t;
  return top;
}
function barGeometry(usedPercent, marker) {
  return { used: clampPct(usedPercent), tick: marker == null ? null : marker * 100 };
}
function mergeProviders(prev, next) {
  const byId = new Map(next.map((p2) => [p2.id, p2]));
  const merged = prev.map((p2) => byId.get(p2.id) ?? p2);
  const missing = next.filter((p2) => !prev.some((q) => q.id === p2.id));
  return [...merged, ...missing];
}

// src/domain/dates.ts
var DAY_MS = 864e5;
var KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
var pad = (n) => String(n).padStart(2, "0");
function keyOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isDayKey(value) {
  if (typeof value !== "string") return false;
  const m = KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return keyOf(d) === value;
}
function fromKey(key) {
  const m = KEY_RE.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function todayKey(now) {
  return keyOf(new Date(now));
}
function addDays(key, n) {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
function addMonths(key, n) {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
function shiftMonthsClamped(key, n) {
  const d = fromKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return keyOf(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
}
function startOfWeek(key) {
  const d = fromKey(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}
function startOfMonth(key) {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(key) {
  const d = fromKey(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function startOfYear(key) {
  return `${key.slice(0, 4)}-01-01`;
}
function endOfYear(key) {
  return `${key.slice(0, 4)}-12-31`;
}
function daysBetween(a, b) {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / DAY_MS);
}
var minKey = (a, b) => a < b ? a : b;
var maxKey = (a, b) => a > b ? a : b;
function parseBucket(bucket) {
  const [day, hour] = bucket.split("T");
  return { day, hour: hour == null ? null : Number(hour) };
}

// src/domain/prefs.ts
var THRESHOLD_CHOICES = [70, 80, 90, 95];
var PROVIDER_IDS = ["claude", "codex"];
var BACKGROUND_POLL_MS = 15 * 6e4;
var PRICE_UPDATE_INTERVAL_MS = 24 * 36e5;
var DEFAULT_PREFS = {
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
  ackUnpriced: ""
};
var oneOf = (value, allowed, fallback) => typeof value === "string" && allowed.includes(value) ? value : fallback;
var bool = (value, fallback) => typeof value === "boolean" ? value : fallback;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function sanitizeThresholds(value) {
  if (!Array.isArray(value)) return [...DEFAULT_PREFS.alerts.thresholds];
  const allowed = new Set(THRESHOLD_CHOICES);
  return [...new Set(value.filter((v) => typeof v === "number" && allowed.has(v)))].sort((a, b) => a - b);
}
function sanitizePrefs(raw) {
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
      codex: bool(providers.codex, d.providers.codex)
    },
    alerts: {
      on: bool(alerts.on, d.alerts.on),
      thresholds: "thresholds" in alerts ? sanitizeThresholds(alerts.thresholds) : [...d.alerts.thresholds],
      background: bool(alerts.background, d.alerts.background)
    },
    priceAuto: bool(raw.priceAuto, d.priceAuto),
    excludedEngines: Array.isArray(raw.excludedEngines) ? [...new Set(raw.excludedEngines.filter((v) => typeof v === "string" && v.length > 0 && v.length <= 64))] : [],
    collapsed: Object.fromEntries(
      Object.entries(collapsed).filter(([k, v]) => typeof v === "boolean" && k.length <= 32)
    ),
    trendBy: oneOf(raw.trendBy, ["engine", "model"], d.trendBy),
    ackUnpriced: typeof raw.ackUnpriced === "string" && raw.ackUnpriced.length <= 1024 ? raw.ackUnpriced : ""
  };
}
function toggleThreshold(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);
}
function toggleInList(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
function enabledProviders(prefs) {
  return PROVIDER_IDS.filter((id) => prefs.providers[id]);
}
function autoRefreshMs(value) {
  return value === "off" ? null : Number(value) * 6e4;
}
function priceUpdateDue(enabled, lastAttemptAt, now) {
  if (!enabled) return false;
  if (lastAttemptAt == null || !Number.isFinite(lastAttemptAt)) return true;
  return now - lastAttemptAt >= PRICE_UPDATE_INTERVAL_MS || lastAttemptAt > now;
}
function chipRange(period, today) {
  if (period === "7d") return { from: addDays(today, -6), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: today, to: today };
}

// src/data/store.ts
function createStore(initial) {
  let state = initial;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => state,
    set(updater) {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
function errorText(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    const s = JSON.stringify(error);
    return s && s !== "{}" ? s : "unknown error";
  } catch {
    return "unknown error";
  }
}

// src/data/limits.ts
var POKE_MIN_MS = 6e4;
function createLimitsService(opts) {
  const { ctx } = opts;
  const now = opts.now ?? (() => Date.now());
  const store = createStore({ phase: "idle", providers: [], error: null, fetching: false, retrying: {}, refreshedAt: null });
  const visible = /* @__PURE__ */ new Set();
  let config = opts.config;
  let timer = null;
  let timerMs = null;
  let retryTimer = null;
  let pokeTimer = null;
  let seq = 0;
  let disposed = false;
  const patch = (fn) => {
    if (!disposed) store.set(fn);
  };
  async function fetch(refresh) {
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
        providers: res.providers.filter((p2) => config.enabled.includes(p2.id)),
        error: null,
        fetching: false,
        refreshedAt: refresh ? now() : s.refreshedAt
      }));
      scheduleRetry();
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
  function scheduleRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (!visible.size) return;
    const at = store.get().providers.filter((p2) => p2.status === "rateLimited" && p2.retryAt != null).reduce((min, p2) => min == null || p2.retryAt < min ? p2.retryAt : min, null);
    if (at == null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      fetch(true).catch(() => void 0);
    }, Math.max(1e3, at - now() + 500));
  }
  function poke() {
    if (disposed || !config.enabled.length || store.get().fetching) return;
    const { refreshedAt } = store.get();
    const wait = refreshedAt == null ? 0 : refreshedAt + POKE_MIN_MS - now();
    if (wait <= 0) {
      fetch(true).catch(() => void 0);
      return;
    }
    if (pokeTimer) return;
    pokeTimer = setTimeout(() => {
      pokeTimer = null;
      fetch(true).catch(() => void 0);
    }, wait);
  }
  function intervalMs() {
    if (visible.size > 0) return config.visibleMs;
    return config.background ? BACKGROUND_POLL_MS : null;
  }
  function reschedule() {
    const ms = intervalMs();
    if (ms === timerMs) return;
    if (timer) clearInterval(timer);
    timer = null;
    timerMs = ms;
    if (ms != null) timer = setInterval(() => void fetch(true).catch(() => void 0), ms);
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
          providers: mergeProviders(s.providers, res.providers.filter((p2) => p2.id === id)),
          retrying: { ...s.retrying, [id]: false }
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
        fetch(stale).catch(() => void 0);
      }
    },
    configure(next) {
      const providersChanged = next.enabled.join() !== config.enabled.join();
      config = next;
      if (timer) clearInterval(timer);
      timer = null;
      timerMs = null;
      reschedule();
      if (providersChanged) fetch(false).catch(() => void 0);
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
    }
  };
}

// src/data/prefs.ts
var PREFS_KEY = "prefs:v1";
var SAVE_DELAY_MS = 250;
function createPrefs(storage) {
  const store = createStore({ prefs: DEFAULT_PREFS, loaded: false, saveError: null });
  let timer = null;
  let dirty = false;
  const save = async () => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await storage.set(PREFS_KEY, store.get().prefs);
      store.set((s) => s.saveError ? { ...s, saveError: null } : s);
    } catch (error) {
      store.set((s) => ({ ...s, saveError: errorText(error) }));
    }
  };
  return {
    store,
    get: () => store.get().prefs,
    async load() {
      try {
        const raw = await storage.get(PREFS_KEY);
        store.set((s) => ({ ...s, prefs: dirty ? s.prefs : sanitizePrefs(raw), loaded: true }));
      } catch (error) {
        store.set((s) => ({ ...s, loaded: true, saveError: errorText(error) }));
      }
    },
    update(fn) {
      store.set((s) => {
        const prefs = fn(s.prefs);
        return prefs === s.prefs ? s : { ...s, prefs };
      });
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    async flush() {
      if (timer) clearTimeout(timer);
      await save();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (dirty) void save();
    }
  };
}

// src/domain/engines.ts
var ENGINES = [
  { id: "claude", label: "Claude Code", color: "var(--color-chart-8, #fdc700)", dir: "~/.claude/projects" },
  { id: "codex", label: "Codex", color: "var(--color-chart-4, #00bcff)", dir: "~/.codex/sessions" },
  { id: "pi", label: "Pi", color: "var(--color-chart-6, #51a2ff)", dir: "~/.pi/agent/sessions" },
  { id: "omp", label: "oh-my-pi", color: "var(--color-chart-2, #9ae600)", dir: "~/.omp/agent/sessions" }
];
var SPARE_COLORS = [
  "var(--color-chart-1, #00d5be)",
  "var(--color-chart-5, #c27aff)",
  "var(--color-chart-3, #fb64b6)",
  "var(--color-chart-7, #00d492)"
];
var MODEL_COLORS = [
  "var(--color-chart-3, #fb64b6)",
  "var(--color-chart-6, #51a2ff)",
  "var(--color-chart-7, #00d492)",
  "var(--color-chart-8, #fdc700)",
  "var(--color-chart-5, #c27aff)",
  "#fb7185",
  "#2dd4bf",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b"
];
var OTHER_COLOR = "var(--color-chart-neutral, #d4d4d4)";
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function assignModelColors(models) {
  const byHash = [...new Set(models)].sort((a, b) => hashString(a) - hashString(b) || a.localeCompare(b));
  const taken = /* @__PURE__ */ new Set();
  const out = /* @__PURE__ */ new Map();
  for (const model of byHash) {
    let slot2 = hashString(model) % MODEL_COLORS.length;
    for (let step = 0; step < MODEL_COLORS.length && taken.has(slot2); step += 1) {
      slot2 = (slot2 + 1) % MODEL_COLORS.length;
    }
    taken.add(slot2);
    out.set(model, MODEL_COLORS[slot2]);
  }
  return out;
}
var BY_ID = new Map(ENGINES.map((e) => [e.id, e]));
function engineDef(id) {
  const known = BY_ID.get(id);
  if (known) return known;
  return { id, label: id, color: SPARE_COLORS[hashString(id) % SPARE_COLORS.length], dir: "" };
}
function engineOrder(a, b) {
  const ia = ENGINES.findIndex((e) => e.id === a);
  const ib = ENGINES.findIndex((e) => e.id === b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b);
}

// src/domain/aggregate.ts
function cacheHitRate(t) {
  const prompt = t.input + t.cacheRead;
  return prompt > 0 ? t.cacheRead / prompt : null;
}
var tokensOf = (r) => r.input + r.output + r.cacheRead + r.cacheWrite;
function sumRows(rows, factor = 1) {
  let total = 0, input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
  let reasoning = 0, requests = 0, sessions = 0, cost = 0, unknownTokens = 0;
  const unknown = /* @__PURE__ */ new Set();
  for (const r of rows) {
    const tokens2 = tokensOf(r) * factor;
    total += tokens2;
    input += r.input * factor;
    output += r.output * factor;
    cacheRead += r.cacheRead * factor;
    cacheWrite += r.cacheWrite * factor;
    reasoning += r.reasoning * factor;
    requests += r.requests * factor;
    sessions += r.sessions * factor;
    if (r.cost == null) {
      unknownTokens += tokens2;
      if (tokens2 > 0) unknown.add(r.model);
    } else {
      cost += r.cost * factor;
    }
  }
  return {
    total,
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning,
    requests,
    sessions,
    cost,
    unknownTokens,
    unknownModels: [...unknown].sort()
  };
}
function filterRows(rows, f) {
  const excluded = f.excluded && f.excluded.length ? new Set(f.excluded) : null;
  return rows.filter((r) => {
    if (excluded && excluded.has(r.engine)) return false;
    if (f.engine && r.engine !== f.engine) return false;
    if (f.from || f.to) {
      const day = r.bucket.length > 10 ? r.bucket.slice(0, 10) : r.bucket;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    return true;
  });
}
function activeDays(rows) {
  const days = /* @__PURE__ */ new Set();
  for (const r of rows) if (tokensOf(r) > 0) days.add(r.bucket.slice(0, 10));
  return days.size;
}
function dailyTotals(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) map.set(r.bucket, (map.get(r.bucket) ?? 0) + tokensOf(r));
  return map;
}
function groupBy(rows, keyFn) {
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const k = keyFn(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}
function engineShares(rows) {
  const all = sumRows(rows).total || 1;
  return [...groupBy(rows, (r) => r.engine).entries()].map(([id, rs]) => {
    const total = sumRows(rs).total;
    return { id, total, share: total / all, models: new Set(rs.map((r) => r.model)).size };
  }).filter((e) => e.total > 0).sort((a, b) => b.total - a.total || engineOrder(a.id, b.id));
}
function modelRanking(rows) {
  const all = sumRows(rows).total || 1;
  return [...groupBy(rows, (r) => r.model).entries()].map(([model, rs]) => {
    const sum = sumRows(rs);
    const byEngine = [...groupBy(rs, (r) => r.engine).entries()].map(([engine, list]) => ({ engine, total: sumRows(list).total })).sort((a, b) => b.total - a.total || engineOrder(a.engine, b.engine));
    return {
      ...sum,
      model,
      engine: byEngine[0]?.engine ?? "",
      engines: byEngine.map((e) => e.engine),
      share: sum.total / all,
      priced: rs.every((r) => r.cost != null)
    };
  }).filter((m) => m.total > 0).sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));
}
function projectRanking(rows, resolve) {
  const all = sumRows(rows).total || 1;
  const refs = /* @__PURE__ */ new Map();
  const grouped = groupBy(rows, (r) => {
    const ref = resolve(r.project);
    refs.set(ref.id, ref);
    return ref.id;
  });
  return [...grouped.entries()].map(([id, rs]) => {
    const sum = sumRows(rs);
    const last = rs.reduce((m, r) => {
      const day = r.bucket.slice(0, 10);
      return tokensOf(r) > 0 && (!m || day > m) ? day : m;
    }, null);
    const ref = refs.get(id);
    return { ...sum, ...ref, share: sum.total / all, last };
  }).filter((p2) => p2.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
function recentDailyAvg(dailyRows, today, n = 7) {
  const totals = dailyTotals(dailyRows);
  const days = [...totals.entries()].filter(([day, v]) => day < today && v > 0).sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, n);
  return days.length ? days.reduce((acc, [, v]) => acc + v, 0) / days.length : 0;
}
function hourlyTotals(hourRows) {
  const out = new Array(24).fill(0);
  for (const r of hourRows) {
    const { hour } = parseBucket(r.bucket);
    if (hour != null && hour >= 0 && hour < 24) out[hour] += tokensOf(r);
  }
  return out;
}
function sameTimeTotal(hours, hour, minuteFraction) {
  let acc = 0;
  for (let h = 0; h < hour; h += 1) acc += hours[h] ?? 0;
  return acc + (hours[hour] ?? 0) * Math.min(Math.max(minuteFraction, 0), 1);
}
function delta(current, previous) {
  return previous > 0 ? current / previous - 1 : null;
}
function todayVsYesterday(todayHours, yesterdayHours, now) {
  const today = sumRows(todayHours).total;
  const prev = sameTimeTotal(hourlyTotals(yesterdayHours), now.getHours(), now.getMinutes() / 60);
  return delta(today, prev);
}
function forecastTotal(opts) {
  if (opts.avg <= 0 || opts.to <= opts.today) return null;
  return opts.periodTotal + daysBetween(opts.today, opts.to) * opts.avg;
}

// src/data/usage.ts
var CHIP_CACHE_KEY = "chip:v1";
var PRICE_ATTEMPT_KEY = "prices:auto:v1";
var DONE_DEBOUNCE_MS = 2e3;
var CHANGE_DEBOUNCE_MS = 300;
var RUNNING_IDLE_MS = 15e3;
var DAY_TICK_MS = 6e4;
var WAKE_MS = 12e4;
var slot = () => ({ phase: "idle", data: null, error: null });
function initialUsageState(now) {
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
    cache: null
  };
}
var omit = (rec, key) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));
function createUsageService(opts) {
  const { ctx } = opts;
  const now = opts.now ?? (() => Date.now());
  const store = createStore(initialUsageState(now()));
  const disposers = [];
  const wanted = /* @__PURE__ */ new Set();
  let seq = 0;
  let disposed = false;
  let doneTimer = null;
  let changeTimer = null;
  let runningTimer = null;
  let refreshInFlight = null;
  const patch = (fn) => {
    if (!disposed) store.set(fn);
  };
  async function fetchHours(day, mySeq) {
    try {
      const res = await ctx.usage.query({ from: day, to: day, bucket: "hour" });
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, hourly: { ...s.hourly, [day]: res.rows }, hourlyError: omit(s.hourlyError, day) }));
    } catch (error) {
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, hourlyError: { ...s.hourlyError, [day]: errorText(error) } }));
    }
  }
  function writeChipCache(s) {
    const scope = opts.chipScope();
    const range = chipRange(scope.period, s.today);
    const sum = sumRows(filterRows(s.daily, { ...range, excluded: scope.excluded }));
    const cache = { day: s.today, period: scope.period, tokens: sum.total, cost: sum.cost };
    const prev = s.cache;
    if (prev && prev.day === cache.day && prev.period === cache.period && prev.tokens === cache.tokens && prev.cost === cache.cost) return;
    patch((st) => ({ ...st, cache }));
    ctx.storage.set(CHIP_CACHE_KEY, cache).catch(() => void 0);
  }
  async function reload() {
    seq += 1;
    const mySeq = seq;
    const today = todayKey(now());
    patch((s) => s.today === today ? s : { ...s, today, hourly: {}, hourlyError: {} });
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
        progress: daily.scanning || head.scanning ? s.progress : null
      }));
      writeChipCache(store.get());
      const days = /* @__PURE__ */ new Set([addDays(today, -1), ...wanted]);
      days.delete(today);
      await Promise.all([...days].map((d) => fetchHours(d, mySeq)));
    } catch (error) {
      if (mySeq !== seq) return;
      patch((s) => ({ ...s, phase: s.phase === "ready" ? "ready" : "error", error: errorText(error) }));
    }
  }
  const scheduleReload = () => {
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      changeTimer = null;
      void reload();
    }, CHANGE_DEBOUNCE_MS);
  };
  async function refresh() {
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
  async function wake() {
    if (disposed) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      await ctx.usage.prices();
    } catch {
    }
  }
  function markRunning(on) {
    if (runningTimer) clearTimeout(runningTimer);
    runningTimer = on ? setTimeout(() => {
      runningTimer = null;
      patch((s) => ({ ...s, running: false }));
    }, RUNNING_IDLE_MS) : null;
    patch((s) => s.running === on ? s : { ...s, running: on });
  }
  async function updatePrices(manual) {
    const at = now();
    patch((s) => ({ ...s, priceUpdate: { ...s.priceUpdate, running: true, error: null } }));
    try {
      const info = await ctx.usage.updatePrices();
      patch((s) => ({
        ...s,
        prices: { phase: "ready", data: info, error: null },
        priceUpdate: { running: false, error: null, lastAttemptAt: at, lastError: null }
      }));
      if (!manual) ctx.storage.set(PRICE_ATTEMPT_KEY, { at, error: null }).catch(() => void 0);
      scheduleReload();
    } catch (error) {
      const message = errorText(error);
      patch((s) => ({
        ...s,
        priceUpdate: { running: false, error: manual ? message : null, lastAttemptAt: at, lastError: manual ? s.priceUpdate.lastError : message }
      }));
      if (!manual) ctx.storage.set(PRICE_ATTEMPT_KEY, { at, error: message }).catch(() => void 0);
      if (manual) throw error;
    }
  }
  const service = {
    store,
    reload,
    refresh,
    ping: wake,
    updatePrices,
    init() {
      ctx.storage.get(CHIP_CACHE_KEY).then((cache) => {
        if (cache && cache.day === store.get().today && typeof cache.tokens === "number") {
          patch((s) => s.cache ? s : { ...s, cache });
        }
      }).catch(() => void 0);
      void reload();
      void service.loadWorkspaces();
      disposers.push(ctx.usage.onChange(() => scheduleReload()));
      disposers.push(
        ctx.usage.onScanProgress((p2) => {
          patch((s) => ({
            ...s,
            progress: p2.finished ? null : p2,
            progressEngines: p2.engine && !s.progressEngines.includes(p2.engine) ? [...s.progressEngines, p2.engine] : s.progressEngines
          }));
          if (p2.finished) scheduleReload();
        })
      );
      disposers.push(ctx.events.on("usage://updated", () => markRunning(true)));
      disposers.push(
        ctx.events.on("usage://done", () => {
          markRunning(false);
          if (doneTimer) clearTimeout(doneTimer);
          doneTimer = setTimeout(() => {
            doneTimer = null;
            refresh().catch(() => void 0);
          }, DONE_DEBOUNCE_MS);
        })
      );
      const tick = setInterval(() => {
        if (todayKey(now()) !== store.get().today) void reload();
      }, DAY_TICK_MS);
      disposers.push(() => clearInterval(tick));
      const beat = setInterval(() => void wake(), WAKE_MS);
      disposers.push(() => clearInterval(beat));
      const onVisible = () => void wake();
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisible);
        disposers.push(() => document.removeEventListener("visibilitychange", onVisible));
      }
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
      const last = await ctx.storage.get(PRICE_ATTEMPT_KEY).catch(() => null);
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
    }
  };
  return service;
}

// src/domain/periods.ts
var MAX_CUSTOM_DAYS = 366;
var WEEKLY_TREND_AFTER_DAYS = 62;
function periodRange(period, anchor, range, today, firstDay) {
  const make = (from, to, gran) => ({
    period,
    from,
    to,
    gran,
    containsToday: from <= today && today <= to
  });
  switch (period) {
    case "day":
      return make(anchor, anchor, "hour");
    case "week": {
      const from = startOfWeek(anchor);
      return make(from, addDays(from, 6), "day");
    }
    case "month":
      return make(startOfMonth(anchor), endOfMonth(anchor), "day");
    case "year":
      return make(startOfYear(anchor), endOfYear(anchor), "month");
    case "custom": {
      const r = range ?? { from: addDays(today, -29), to: today };
      const days = daysBetween(r.from, r.to) + 1;
      return make(r.from, r.to, days > WEEKLY_TREND_AFTER_DAYS ? "week" : "day");
    }
    default:
      return make(minKey(firstDay ?? today, today), today, "month");
  }
}
function shiftAnchor(period, anchor, dir) {
  if (period === "day") return addDays(anchor, dir);
  if (period === "week") return addDays(anchor, dir * 7);
  if (period === "month") return shiftMonthsClamped(anchor, dir);
  if (period === "year") return shiftMonthsClamped(anchor, dir * 12);
  return anchor;
}
function canShift(period, anchor, dir, today, firstDay) {
  if (period === "all" || period === "custom") return false;
  const next = periodRange(period, shiftAnchor(period, anchor, dir), null, today, firstDay);
  if (dir > 0) return next.from <= today;
  return next.to >= (firstDay ?? today);
}
var elapsedEnd = (pr, today) => minKey(pr.to, today);
function previousRange(pr, today) {
  if (pr.period === "all") return null;
  if (pr.period === "day") {
    const d = addDays(pr.from, -1);
    return { from: d, to: d, mode: pr.containsToday ? "sameTime" : "full", span: 1 };
  }
  const span = daysBetween(pr.from, pr.to) + 1;
  const elapsed = daysBetween(pr.from, elapsedEnd(pr, today)) + 1;
  let prevFrom;
  if (pr.period === "month") prevFrom = addMonths(pr.from, -1);
  else if (pr.period === "year") prevFrom = `${Number(pr.from.slice(0, 4)) - 1}-01-01`;
  else prevFrom = addDays(pr.from, -span);
  const prevTo = minKey(addDays(prevFrom, elapsed - 1), addDays(pr.from, -1));
  return { from: prevFrom, to: prevTo, mode: pr.containsToday ? "toDate" : "full", span };
}
function anchorForSwitch(current, anchor, range, next, today) {
  if (next === "all") return today;
  if (current === "custom" && range) return range.to;
  return anchor;
}
function validateCustomRange(draft, today) {
  if (!draft.from || !draft.to) return { ok: false, reason: "incomplete", days: 0 };
  const days = daysBetween(draft.from, draft.to) + 1;
  if (draft.to > today) return { ok: false, reason: "future", days };
  if (days > MAX_CUSTOM_DAYS) return { ok: false, reason: "tooLong", days };
  return { ok: true, days };
}
function pickDraftDay(draft, key) {
  if (!draft.from || draft.to || key < draft.from) return { from: key, to: null };
  return { from: draft.from, to: key };
}
function presetRange(preset, today) {
  if (preset === "ytd") return { from: startOfYear(today), to: today };
  return { from: addDays(today, -(Number(preset) - 1)), to: today };
}
function rollingRange(days, today) {
  return { from: addDays(today, -(days - 1)), to: today };
}
function monthGrid(monthKey) {
  const first = startOfMonth(monthKey);
  const lead = (fromKey(first).getDay() + 6) % 7;
  const days = [];
  for (let k = first, last = endOfMonth(first); k <= last; k = addDays(k, 1)) days.push(k);
  return { lead, days };
}

// src/domain/table.ts
var DEFAULT_SORT = {
  time: { key: "key", dir: "desc" },
  project: { key: "total", dir: "desc" },
  model: { key: "total", dir: "desc" }
};
var TEXT_KEYS = /* @__PURE__ */ new Set(["name", "model", "engine"]);
function nextSort(current, key) {
  if (current.key === key) return { key, dir: current.dir === "desc" ? "asc" : "desc" };
  return { key, dir: TEXT_KEYS.has(key) ? "asc" : "desc" };
}
function ariaSort(current, key) {
  if (current.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}
function sortRows(rows, sort) {
  const field = sort.key === "key" ? "order" : sort.key;
  const dir = sort.dir === "asc" ? 1 : -1;
  return rows.map((row, i) => ({ row, i })).sort((a, b) => {
    const x = a.row[field];
    const y = b.row[field];
    const xNull = x == null;
    const yNull = y == null;
    if (xNull || yNull) return xNull && yNull ? a.i - b.i : xNull ? 1 : -1;
    const c = typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y);
    return c !== 0 ? c * dir : a.i - b.i;
  }).map((e) => e.row);
}

// src/domain/view.ts
function initialView(today) {
  return {
    page: "overview",
    period: "month",
    anchor: today,
    range: null,
    engine: null,
    table: "time",
    sort: { ...DEFAULT_SORT },
    modelsOpen: false,
    drawer: null,
    layer: null,
    popover: false,
    tableFocus: 0
  };
}
var closeOverlays = (s) => ({ ...s, layer: null, drawer: null });
function setPage(s, page) {
  return { ...closeOverlays(s), page };
}
function setPeriod(s, period, today) {
  return { ...s, period, anchor: anchorForSwitch(s.period, s.anchor, s.range, period, today), range: null, layer: null };
}
function shift(s, dir) {
  return { ...s, anchor: shiftAnchor(s.period, s.anchor, dir) };
}
function goToday(s, today) {
  return { ...s, anchor: today };
}
function applyRange(s, range) {
  return { ...s, period: "custom", range, anchor: range.to, layer: null };
}
function toggleEngine(s, id) {
  return { ...s, engine: id && s.engine !== id ? id : null };
}
function drill(s, d, today) {
  if (d.kind === "day") return { ...closeOverlays(s), period: "day", anchor: d.key, range: null };
  if (d.kind === "month") return { ...closeOverlays(s), period: "month", anchor: d.key, range: null };
  return applyRange(closeOverlays(s), { from: d.key, to: minKey(addDays(d.key, 6), today) });
}
function setTable(s, table, focus = false) {
  return { ...s, table, tableFocus: focus ? s.tableFocus + 1 : s.tableFocus };
}
function sortBy(s, key) {
  return { ...s, sort: { ...s.sort, [s.table]: nextSort(s.sort[s.table], key) } };
}
function toggleLayer(s, layer) {
  return { ...s, layer: s.layer === layer ? null : layer };
}

// src/i18n/en.ts
var en = {
  "plugin.name": "Usage & Limits",
  "nav.label": "Usage",
  "tab.title": "Usage",
  "cmd.open": "Open usage",
  "cmd.openLimits": "Open usage limits",
  "cmd.refresh": "Usage: refresh now",
  "chip.today": "Today",
  "chip.7d": "7 days",
  "chip.month": "This month",
  "chip.tokens": "tokens",
  "chip.scanning": "Counting usage… {pct}%",
  "chip.scanningTitle": "Building the local usage index for the first time",
  "chip.empty": "No usage yet",
  "chip.emptyTitle": "No usage recorded yet · click to view",
  "chip.loading": "Usage…",
  "chip.error": "Usage unavailable",
  "chip.noLimit": "No limit data",
  "chip.title": "{label} {tokens} tokens · est. {cost}",
  "chip.updated": "updated {ago}",
  "chip.click": "Click to view usage and limits",
  "pop.label": "Usage summary",
  "pop.updated": "Updated {ago}",
  "pop.never": "Not scanned yet",
  "pop.overview": "Usage overview",
  "pop.limits": "Limit details",
  "pop.scanningTitle": "Building the usage index · {pct}%",
  "pop.scanningBody": "Read {done} / {total} session files. Later updates only read new content.",
  "pop.emptyTitle": "No usage recorded yet",
  "pop.emptyBody": "Finish a conversation in CC GUI or any supported CLI and statistics will appear here.",
  "pop.vsYesterday": "vs. yesterday at this time",
  "pop.last7": "Last 7 days",
  "pop.last30": "Last 30 days",
  "pop.all": "All time",
  "pop.activeDays": "{n} active days",
  "pop.dailyAvg": "{v} / day",
  "pop.since": "since {date}",
  "pop.split": "Input {input} · Output {output} · Cache read {cacheRead} · Cache write {cacheWrite} · Cache hit {hit}",
  "pop.splitTitle": "Token breakdown",
  "say.scanning": "Counting tokens — the first pass takes a while…",
  "say.empty": "No usage yet — start a conversation",
  "say.error": "Can't read usage right now",
  "say.alert": "{provider} {window} window is filling up fast",
  "say.started": "Off to a start today",
  "say.same": "About the same as yesterday",
  "say.more": "{pct}% more than yesterday by now",
  "say.less": "{pct}% less than yesterday by now",
  "say.todayTokens": "Today: {tokens} tokens",
  "say.todayCost": "Today's AI bill: {cost}",
  "say.cycle": "Click to switch",
  "common.refresh": "Refresh",
  "common.retry": "Retry",
  "common.retrying": "Retrying…",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.apply": "Apply",
  "common.settings": "Usage & Limits settings",
  "common.used": "Used",
  "common.limits": "Limits",
  "common.loadError": "Couldn't read usage: {error}",
  "common.refreshError": "Refresh failed: {error}",
  "common.noData": "No data",
  "common.copy": "Copy command",
  "common.copied": "Copied",
  "common.copyFailed": "Copy failed — select the text manually",
  "common.copyLink": "Copy link",
  "common.linkCopied": "Link copied",
  "common.otherDir": "Other folders",
  "common.noWorkspace": "Not inside any registered workspace",
  "page.title": "Usage",
  "page.tabs": "Usage pages",
  "page.overview": "Overview",
  "page.limits": "Limits",
  "page.sources": "Data sources",
  "period.aria": "Period",
  "period.day": "Day",
  "period.week": "Week",
  "period.month": "Month",
  "period.year": "Year",
  "period.all": "All",
  "period.custom": "Custom",
  "unit.day": "day",
  "unit.week": "week",
  "unit.month": "month",
  "unit.year": "year",
  "nav.prev": "Previous {unit}",
  "nav.next": "Next {unit}",
  "nav.back.day": "Back to today",
  "nav.back.week": "Back to this week",
  "nav.back.month": "Back to this month",
  "nav.back.year": "Back to this year",
  "nav.todaySuffix": " (today)",
  "nav.allLabel": "All (since {date})",
  "nav.days": "{n} days",
  "filter.only": "Only {name}",
  "filter.clear": "Clear filter",
  "hero.kicker": "Total tokens",
  "hero.sub": "{range} · usage on {active} of {span} days",
  "hero.forecast": "at the last 7 active days' pace, {scope} ends near {v}",
  "hero.scopePeriod": "this {unit}",
  "hero.scopeCustom": "the range",
  "hero.cost": "Cost (estimate)",
  "hero.costInfo": "Estimated from the price table: input + output + cache read + cache write. Subscriptions (Claude Max, ChatGPT Pro, …) are not billed this way; use it as an order of magnitude.",
  "hero.shares": "Usage share by engine",
  "hero.unknown": "{n} model(s) have no price ({models}); {tokens} tokens are not included in the cost.",
  "hero.dismiss": "Dismiss",
  "engine.all": "All",
  "engine.sub": "{n} models · {tokens}",
  "cmp.sameTime": "vs. yesterday at this time",
  "cmp.prevDay": "vs. previous day",
  "cmp.week": "vs. last week",
  "cmp.weekToDate": "vs. last week to date",
  "cmp.month": "vs. last month",
  "cmp.monthToDate": "vs. last month to date",
  "cmp.year": "vs. last year",
  "cmp.yearToDate": "vs. last year to date",
  "cmp.custom": "vs. previous {n} days",
  "trend.title": "Trend",
  "trend.by": "Stack by",
  "trend.byEngine": "Engine",
  "trend.byModel": "Model",
  "trend.forecast": "Forecast",
  "trend.other": "Other",
  "trend.aria": "Trend bars; use the arrow keys to move and Enter to drill in",
  "trend.tipForecast": "Forecast ≈ {v}",
  "trend.tipForecastNote": "Average of the last 7 active days",
  "trend.tipFuture": "Not yet",
  "trend.tipDrill": "Click to drill in",
  "trend.barAria": "{label}: {v} tokens",
  "trend.barFuture": "{label}: not yet",
  "table.aria": "Breakdown",
  "table.tab.hour": "By hour",
  "table.tab.day": "By day",
  "table.tab.week": "By week",
  "table.tab.month": "By month",
  "table.tab.project": "By project",
  "table.tab.model": "By model",
  "table.rows": "{n} rows",
  "table.empty": "No usage in this period",
  "col.hour": "Time",
  "col.day": "Date",
  "col.week": "Week",
  "col.month": "Month",
  "col.total": "Total",
  "col.input": "Input",
  "col.output": "Output",
  "col.cacheRead": "Cache read",
  "col.cacheWrite": "Cache write",
  "col.cacheHit": "Cache hit",
  "col.reasoning": "Reasoning",
  "col.reasoningInfo": "Reasoning tokens are already part of Output; this column is informational and not added to the total.",
  "col.requests": "Requests",
  "col.cost": "Cost",
  "col.name": "Project",
  "col.share": "Share",
  "col.last": "Last active",
  "col.model": "Model",
  "col.engine": "Engine",
  "col.priced": "Price",
  "col.pricedYes": "Price table",
  "col.pricedNo": "Unknown price",
  "stats.avg": "Daily average",
  "stats.avgNote": "over active days",
  "stats.activeDays": "Active days",
  "stats.requests": "Requests",
  "stats.requestsNote": "model responses",
  "stats.sessions": "Sessions",
  "stats.first": "First use {date}",
  "stats.total": "{n} active days in total",
  "models.title": "Top models",
  "models.meta": "by tokens",
  "models.more": "Show all ({n})",
  "models.less": "Show less",
  "heat.title": "Heatmap",
  "heat.meta": "Last 26 weeks",
  "heat.less": "Less",
  "heat.more": "More",
  "heat.note": "Cells outside the period are dimmed",
  "heat.days": "Mon,,Wed,,Fri,,",
  "heat.none": "No usage",
  "scan.title": "Counting local usage",
  "scan.body": "The first pass reads every historical session log ({done} / {total} files); later updates only read new content. Feel free to do something else — this page refreshes when done.",
  "scan.waiting": "Waiting",
  "scan.running": "Reading",
  "scan.done": "Done",
  "scan.files": "{n} files",
  "empty.title": "No usage recorded yet",
  "empty.dirs": "Folders searched ({n})",
  "error.title": "Couldn't read usage",
  "range.aria": "Custom date range",
  "range.p7": "Last 7 days",
  "range.p30": "Last 30 days",
  "range.p90": "Last 90 days",
  "range.ytd": "This year",
  "range.pickEnd": "Pick an end date",
  "range.tooLong": "At most 366 days (currently {n})",
  "range.future": "Future dates can't be selected",
  "range.summary": "{from} – {to} · {n} days",
  "range.prevMonth": "Previous month",
  "range.nextMonth": "Next month",
  "range.weekdays": "Mo,Tu,We,Th,Fr,Sa,Su",
  "drawer.aria": "Project usage: {name}",
  "drawer.total": "Total",
  "drawer.cost": "Cost",
  "drawer.requests": "Requests",
  "drawer.byEngine": "By engine",
  "drawer.byModel": "By model",
  "drawer.last30": "Last 30 days",
  "src.title": "Data sources",
  "src.desc": "Session log folders of each CLI. Updated incrementally after each turn; CLIs run outside CC GUI are picked up by the file watcher.",
  "src.missing": "Folder not found",
  "src.denied": "No read permission",
  "src.error": "Read error",
  "src.files": "{n} files",
  "src.excluded": "Excluded",
  "src.env": "Overridable via {env}",
  "src.loadError": "Couldn't read data sources: {error}",
  "src.rescan": "Rescan everything",
  "src.rescanHint": "Rebuilds the local index; the CLIs' own logs are never modified",
  "src.rescanning": "Rescanning… {pct}%",
  "src.rescanError": "Rescan failed: {error}",
  "lim.intro": "Rate-limit windows of your subscriptions. Only the CLIs' existing local logins are used to query the official endpoints; your credentials are never refreshed or rewritten.",
  "lim.hidden": "Hidden in settings: {names}",
  "lim.gotoSettings": "Open settings",
  "lim.noneTitle": "No providers enabled",
  "lim.noneBody": "Turn on Claude or Codex in settings to see their limits here.",
  "lim.loading": "Loading…",
  "lim.updated": "Updated {ago}",
  "lim.dataAgo": "data from {ago}",
  "lim.loadError": "Couldn't read limits: {error}",
  "lim.signedOutTitle": "No {name} login found",
  "lim.signedOutDesc": "Run the command below in a terminal and finish signing in, then hit refresh.",
  "lim.expiredTitle": "{name} login expired",
  "lim.expiredDesc": "The plugin never refreshes logins for you. Run the command below once so the CLI renews itself, then refresh.",
  "lim.signedOutLine": "Signed out · run {cmd} in a terminal",
  "lim.expiredLine": "Login expired · run {cmd} once to renew",
  "lim.rateLimitedLine": "Rate limited · retrying automatically",
  "lim.offlineLine": "Can't reach {host}",
  "lim.errorLine": "Failed: {error}",
  "lim.rateLimited": "Rate limited (429); showing data from {ago} · retrying in {retry}",
  "lim.rateLimitedNoRetry": "Rate limited (429); showing data from {ago}, retrying automatically",
  "lim.offline": "Can't reach {host} (network error). Showing data from {ago}.",
  "lim.offlineNoData": "Can't reach {host} (network error).",
  "lim.error": "Failed: {error}",
  "lim.hours": "{n} hours",
  "lim.days": "{n} days",
  "lim.weekly": "Weekly",
  "lim.modelTag": "Model",
  "lim.scoped": "{span} · {model}",
  "lim.resetIn": "resets in {dur}",
  "lim.resetAt": "resets {at}",
  "lim.paceIdle": "Not used in this window yet",
  "lim.paceEarly": "Window just started — no projection yet",
  "lim.paceUnknown": "Missing window length or reset time; pace unavailable",
  "lim.paceOk": "On pace · about {v} used at reset",
  "lim.paceOver": "Too fast · runs out in about {runOut}, {early} before the reset",
  "lim.paceExhausted": "Used up · waiting for the reset",
  "lim.tipNote": "The tick is where an even burn would be by now; filling past it means burning fast.",
  "lim.barAria": "{label} used {v}%",
  "lim.extra": "Extra usage",
  "lim.extraMonth": "This month",
  "lim.extraDesc": "Pay-as-you-go usage after the subscription allowance (Extra usage); hidden when the account doesn't have it.",
  "lim.weeklyOnly": "The current plan ({plan}) only has a weekly window.",
  "lim.weeklyOnlyNoPlan": "The current plan only has a weekly window.",
  "bell.label": "Alert settings",
  "bell.title": "Alert near the limit",
  "bell.desc": "When any window reaches a threshold below, the status-bar number gets a warning tag and the sidebar entry shows the percentage. System notifications need a future host capability.",
  "bell.thresholds": "Alert thresholds",
  "bell.chip": "Show 5h / 7d windows in the status bar",
  "bell.background": "Keep checking in the background (every 15 min)",
  "set.head": "Plugin · v{version} · numbers are computed locally by CC GUI; the plugin only displays them",
  "set.status": "Status bar",
  "set.chipMode": "Shows",
  "set.mode.both": "Tokens + cost",
  "set.mode.tokens": "Tokens only",
  "set.mode.cost": "Cost only",
  "set.mode.limit": "Tightest limit window",
  "set.chipPeriod": "Range",
  "set.period.today": "Today",
  "set.period.7d": "Last 7 days",
  "set.period.month": "This month",
  "set.logo": "CC GUI logo",
  "set.logoDesc": "Uses the CC GUI app icon as the status mark; off shows a line icon.",
  "set.motion": "Logo animation",
  "set.motionDesc": "Bobs while a session runs and blinks now and then; always still when the system asks to reduce motion.",
  "set.chipLimits": "Status-bar limits",
  "set.chipLimitsDesc": "Keeps each provider's 5-hour and weekly windows (with its logo) after the numbers; they switch to the warning color at the alert threshold.",
  "set.limits": "Limits",
  "set.autoRefresh": "Auto refresh",
  "set.autoRefreshDesc": "Refreshes by this interval while the status-bar tags, the popover or the limits page is visible; a finished turn also refreshes once.",
  "set.every": "Every {n} min",
  "set.off": "Off",
  "set.claude": "Claude",
  "set.claudeDesc": "Reads Claude Code's local login (macOS Keychain / ~/.claude/.credentials.json) and only calls api.anthropic.com.",
  "set.codex": "Codex",
  "set.codexDesc": "Reads ~/.codex/auth.json and only calls chatgpt.com.",
  "set.alerts": "Alert near the limit",
  "set.alertsDesc": "Marks the status bar and sidebar at the thresholds; system notifications will follow once the host offers them.",
  "set.background": "Background checks",
  "set.backgroundDesc": "With the status-bar tags hidden, keeps checking every 15 minutes after the popover closes so the warning tag stays current.",
  "set.sources": "Data sources",
  "set.include": "Count {name}",
  "set.excludeNote": "Turning a source off only hides it from this plugin's statistics; the host still reads the folder.",
  "set.rescan": "Rescan",
  "set.rescanDesc": "Rebuilds the local index without touching the CLIs' logs. Folders follow CLAUDE_CONFIG_DIR, CODEX_HOME and similar variables.",
  "set.prices": "Prices",
  "set.priceTable": "Price table",
  "set.priceBundled": "Bundled snapshot · {date} · {n} models",
  "set.priceOnline": "Online price table · {date} · {n} models",
  "set.priceUpdatedAt": "Last updated {at}",
  "set.updateNow": "Update now",
  "set.priceAuto": "Auto-update the price table",
  "set.priceAutoDesc": "Downloads LiteLLM's public price table from GitHub every 24 hours — download only, nothing is uploaded; keeps the previous table on failure.",
  "set.priceLastError": "Last automatic update failed: {error}",
  "set.priceError": "Couldn't read price-table info: {error}",
  "set.priceUpdateError": "Price-table update failed: {error}",
  "set.noPrice": "Models without a price",
  "set.noPriceDesc": "Their usage is not counted in the cost, and no other model's price is guessed.",
  "set.noPriceNone": "None",
  "set.privacy": "Privacy & credits",
  "set.privacy1": "Usage is computed entirely on this machine and nothing is uploaded (the price-table update only downloads a public file).",
  "set.privacy2": "Limits are queried with the CLIs' existing local logins and only sent to each vendor's official endpoint. Credentials stay in the CC GUI main process; the plugin never sees them.",
  "set.privacy3": "Interaction and information architecture reference {tokentracker} (MIT © 2026 xiufengsun); visuals, copy and code are original to this plugin; the status mark is the CC GUI app icon and the provider marks belong to their owners. Full notice: {notices} in the plugin repository.",
  "set.saveError": "Settings could not be saved: {error}"
};

// src/i18n/zh.ts
var zh = {
  "plugin.name": "用量与限额",
  "nav.label": "用量",
  "tab.title": "用量",
  "cmd.open": "打开用量",
  "cmd.openLimits": "打开用量限额",
  "cmd.refresh": "用量：立即刷新",
  "chip.today": "今日",
  "chip.7d": "7 天",
  "chip.month": "本月",
  "chip.tokens": "tokens",
  "chip.scanning": "统计用量… {pct}%",
  "chip.scanningTitle": "正在首次统计本机用量",
  "chip.empty": "暂无用量",
  "chip.emptyTitle": "还没有用量记录 · 点击查看",
  "chip.loading": "用量…",
  "chip.error": "用量不可用",
  "chip.noLimit": "无限额数据",
  "chip.title": "{label} {tokens} tokens · 估算 {cost}",
  "chip.updated": "{ago}更新",
  "chip.click": "点击查看用量与限额",
  "pop.label": "用量概览",
  "pop.updated": "更新于 {ago}",
  "pop.never": "尚未扫描",
  "pop.overview": "用量概览",
  "pop.limits": "限额详情",
  "pop.scanningTitle": "正在首次统计本机用量 · {pct}%",
  "pop.scanningBody": "已读取 {done} / {total} 个会话文件。之后只增量读取新内容。",
  "pop.emptyTitle": "还没有用量记录",
  "pop.emptyBody": "在 CC GUI 或任一受支持的 CLI 里完成一次对话后，这里会自动出现统计。",
  "pop.vsYesterday": "较昨日同时",
  "pop.last7": "近 7 天",
  "pop.last30": "近 30 天",
  "pop.all": "总计",
  "pop.activeDays": "{n} 个活跃日",
  "pop.dailyAvg": "日均 {v}",
  "pop.since": "自 {date}",
  "pop.split": "输入 {input} · 输出 {output} · 缓存读 {cacheRead} · 缓存写 {cacheWrite} · 缓存命中 {hit}",
  "pop.splitTitle": "Token 明细",
  "say.scanning": "正在数 token，第一次会久一点…",
  "say.empty": "还没有用量，开始一段对话吧",
  "say.error": "暂时读不到用量",
  "say.alert": "{provider} {window} 窗口用得有点快",
  "say.started": "今天开工了",
  "say.same": "和昨天这个时候差不多",
  "say.more": "比昨天这个时候多用了 {pct}%",
  "say.less": "比昨天这个时候少用了 {pct}%",
  "say.todayTokens": "今日 {tokens} tokens",
  "say.todayCost": "今日 AI 账单：{cost}",
  "say.cycle": "点击切换展示",
  "common.refresh": "刷新",
  "common.retry": "重试",
  "common.retrying": "重试中…",
  "common.close": "关闭",
  "common.cancel": "取消",
  "common.apply": "应用",
  "common.settings": "用量与限额设置",
  "common.used": "已用",
  "common.limits": "限额",
  "common.loadError": "读取用量失败：{error}",
  "common.refreshError": "刷新失败：{error}",
  "common.noData": "没有数据",
  "common.copy": "复制命令",
  "common.copied": "已复制",
  "common.copyFailed": "复制失败，请手动选择文本",
  "common.copyLink": "复制链接",
  "common.linkCopied": "已复制链接",
  "common.otherDir": "其他目录",
  "common.noWorkspace": "不在任何已登记的工作区内",
  "page.title": "用量",
  "page.tabs": "用量分页",
  "page.overview": "概览",
  "page.limits": "限额",
  "page.sources": "数据来源",
  "period.aria": "统计周期",
  "period.day": "日",
  "period.week": "周",
  "period.month": "月",
  "period.year": "年",
  "period.all": "全部",
  "period.custom": "自定义",
  "unit.day": "天",
  "unit.week": "周",
  "unit.month": "月",
  "unit.year": "年",
  "nav.prev": "上一{unit}",
  "nav.next": "下一{unit}",
  "nav.back.day": "回到今天",
  "nav.back.week": "回到本周",
  "nav.back.month": "回到本月",
  "nav.back.year": "回到今年",
  "nav.todaySuffix": "（今天）",
  "nav.allLabel": "全部（自 {date}）",
  "nav.days": "{n} 天",
  "filter.only": "只看 {name}",
  "filter.clear": "取消筛选",
  "hero.kicker": "Token 总数",
  "hero.sub": "{range} · {span} 天中 {active} 天有用量",
  "hero.forecast": "按近 7 个活跃日均值，{scope}预计约 {v}",
  "hero.scopePeriod": "本{unit}",
  "hero.scopeCustom": "区间",
  "hero.cost": "费用（估算）",
  "hero.costInfo": "按价格表估算：输入 + 输出 + 缓存读 + 缓存写。订阅套餐（Claude Max、ChatGPT Pro 等）实际不按此计费，只作量级参考。",
  "hero.shares": "各引擎用量占比",
  "hero.unknown": "{n} 个模型没有价格（{models}），这部分 {tokens} tokens 未计入费用。",
  "hero.dismiss": "关闭提示",
  "engine.all": "全部",
  "engine.sub": "{n} 个模型 · {tokens}",
  "cmp.sameTime": "较昨日同时",
  "cmp.prevDay": "较前一天",
  "cmp.week": "较上周",
  "cmp.weekToDate": "较上周同期",
  "cmp.month": "较上月",
  "cmp.monthToDate": "较上月同期",
  "cmp.year": "较去年",
  "cmp.yearToDate": "较去年同期",
  "cmp.custom": "较前 {n} 天",
  "trend.title": "趋势",
  "trend.by": "堆叠方式",
  "trend.byEngine": "按引擎",
  "trend.byModel": "按模型",
  "trend.forecast": "预测",
  "trend.other": "其他",
  "trend.aria": "趋势柱，可用左右方向键移动，回车查看这一段",
  "trend.tipForecast": "预测约 {v}",
  "trend.tipForecastNote": "近 7 个活跃日的日均值",
  "trend.tipFuture": "尚未到来",
  "trend.tipDrill": "点击查看这一段",
  "trend.barAria": "{label}：{v} tokens",
  "trend.barFuture": "{label}：未到来",
  "table.aria": "明细维度",
  "table.tab.hour": "按时间",
  "table.tab.day": "按日期",
  "table.tab.week": "按周",
  "table.tab.month": "按月份",
  "table.tab.project": "按项目",
  "table.tab.model": "按模型",
  "table.rows": "{n} 行",
  "table.empty": "这个周期没有用量",
  "col.hour": "时间",
  "col.day": "日期",
  "col.week": "周",
  "col.month": "月份",
  "col.total": "总计",
  "col.input": "输入",
  "col.output": "输出",
  "col.cacheRead": "缓存读",
  "col.cacheWrite": "缓存写",
  "col.cacheHit": "缓存命中",
  "col.reasoning": "推理",
  "col.reasoningInfo": "推理 tokens 已包含在「输出」里，单列只供参考，不重复计入总计。",
  "col.requests": "请求",
  "col.cost": "费用",
  "col.name": "项目",
  "col.share": "占比",
  "col.last": "最近活跃",
  "col.model": "模型",
  "col.engine": "引擎",
  "col.priced": "价格",
  "col.pricedYes": "价格表",
  "col.pricedNo": "未知价格",
  "stats.avg": "日均",
  "stats.avgNote": "按有用量的天",
  "stats.activeDays": "活跃天数",
  "stats.requests": "请求",
  "stats.requestsNote": "模型响应次数",
  "stats.sessions": "会话",
  "stats.first": "首次使用 {date}",
  "stats.total": "累计 {n} 天有用量",
  "models.title": "模型排行",
  "models.meta": "按 tokens",
  "models.more": "展开全部（{n}）",
  "models.less": "收起",
  "heat.title": "热力图",
  "heat.meta": "近 26 周",
  "heat.less": "少",
  "heat.more": "多",
  "heat.note": "当前周期外的格子变淡",
  "heat.days": "一,,三,,五,,",
  "heat.none": "没有用量",
  "scan.title": "正在统计本机用量",
  "scan.body": "第一次需要读取全部历史会话日志（{done} / {total} 个文件），之后只增量读取新内容。可以先去做别的，完成后这里会自动刷新。",
  "scan.waiting": "等待中",
  "scan.running": "读取中",
  "scan.done": "已完成",
  "scan.files": "{n} 个文件",
  "empty.title": "还没有用量记录",
  "empty.dirs": "查找过的目录（{n}）",
  "error.title": "读取用量失败",
  "range.aria": "自定义日期区间",
  "range.p7": "近 7 天",
  "range.p30": "近 30 天",
  "range.p90": "近 90 天",
  "range.ytd": "今年",
  "range.pickEnd": "选择结束日期",
  "range.tooLong": "最长 366 天（当前 {n} 天）",
  "range.future": "不能选择未来的日期",
  "range.summary": "{from} – {to} · {n} 天",
  "range.prevMonth": "上个月",
  "range.nextMonth": "下个月",
  "range.weekdays": "一,二,三,四,五,六,日",
  "drawer.aria": "项目用量：{name}",
  "drawer.total": "总计",
  "drawer.cost": "费用",
  "drawer.requests": "请求",
  "drawer.byEngine": "按引擎",
  "drawer.byModel": "按模型",
  "drawer.last30": "近 30 天",
  "src.title": "数据来源",
  "src.desc": "每个 CLI 的会话日志目录。对话结束后自动增量更新；CC GUI 之外运行的 CLI 由文件监听补齐。",
  "src.missing": "未找到目录",
  "src.denied": "无读取权限",
  "src.error": "读取出错",
  "src.files": "{n} 个文件",
  "src.excluded": "已排除",
  "src.env": "可由 {env} 覆盖",
  "src.loadError": "读取数据来源失败：{error}",
  "src.rescan": "重新扫描全部",
  "src.rescanHint": "重建本地索引，不改动各 CLI 的原始日志",
  "src.rescanning": "正在重新扫描… {pct}%",
  "src.rescanError": "重新扫描失败：{error}",
  "lim.intro": "订阅账号的速率限制窗口。只读取本机 CLI 已有的登录状态去查询官方接口，不刷新、不改写你的登录凭据。",
  "lim.hidden": "已在设置中隐藏：{names}",
  "lim.gotoSettings": "去设置",
  "lim.noneTitle": "没有启用的平台",
  "lim.noneBody": "在设置里打开 Claude 或 Codex 后，这里会显示它们的限额。",
  "lim.loading": "读取中…",
  "lim.updated": "更新于 {ago}",
  "lim.dataAgo": "{ago}的数据",
  "lim.loadError": "读取限额失败：{error}",
  "lim.signedOutTitle": "未检测到 {name} 登录",
  "lim.signedOutDesc": "在终端运行下面的命令并完成登录，然后点右上角刷新。",
  "lim.expiredTitle": "{name} 登录已过期",
  "lim.expiredDesc": "插件不会替你刷新登录。在终端运行一次下面的命令，让 CLI 自己续期后再刷新。",
  "lim.signedOutLine": "未登录 · 在终端运行 {cmd} 登录",
  "lim.expiredLine": "登录已过期 · 在终端运行一次 {cmd} 续期",
  "lim.rateLimitedLine": "接口限流 · 稍后自动重试",
  "lim.offlineLine": "无法连接 {host}",
  "lim.errorLine": "读取失败：{error}",
  "lim.rateLimited": "接口限流（429），显示 {ago}的数据 · {retry}后自动重试",
  "lim.rateLimitedNoRetry": "接口限流（429），显示 {ago}的数据，稍后自动重试",
  "lim.offline": "无法连接 {host}（网络错误）。下面是 {ago}的数据。",
  "lim.offlineNoData": "无法连接 {host}（网络错误）。",
  "lim.error": "读取失败：{error}",
  "lim.hours": "{n} 小时",
  "lim.days": "{n} 天",
  "lim.weekly": "每周",
  "lim.modelTag": "模型",
  "lim.scoped": "{span} · {model}",
  "lim.resetIn": "{dur}后重置",
  "lim.resetAt": "{at} 重置",
  "lim.paceIdle": "本窗口尚未使用",
  "lim.paceEarly": "窗口刚开始，暂不预测",
  "lim.paceUnknown": "缺少窗口时长或重置时间，无法估算节奏",
  "lim.paceOk": "节奏正常 · 预计重置时用到 {v}",
  "lim.paceOver": "偏快 · 按当前速度约 {runOut}后用完，比重置早 {early}",
  "lim.paceExhausted": "已用完 · 等待重置",
  "lim.tipNote": "竖标为匀速到现在应到的位置，填充超过即为偏快。",
  "lim.barAria": "{label}已用 {v}%",
  "lim.extra": "额外用量",
  "lim.extraMonth": "本月",
  "lim.extraDesc": "订阅额度用完后按量计费的部分（Extra usage）；账号未开启时不显示这一行。",
  "lim.weeklyOnly": "当前套餐（{plan}）只有每周窗口。",
  "lim.weeklyOnlyNoPlan": "当前套餐只有每周窗口。",
  "bell.label": "提醒设置",
  "bell.title": "接近上限时提醒",
  "bell.desc": "任一窗口达到下列阈值时，状态栏数字后追加告急标记，侧栏「用量」显示百分比。系统通知需要宿主后续开放。",
  "bell.thresholds": "提醒阈值",
  "bell.chip": "状态栏显示 5h / 7d 窗口",
  "bell.background": "关闭面板后仍在后台查询（15 分钟）",
  "set.head": "插件 · v{version} · 数字由 CC GUI 在本机计算，插件只负责显示",
  "set.status": "状态栏",
  "set.chipMode": "显示内容",
  "set.mode.both": "Tokens + 费用",
  "set.mode.tokens": "仅 Tokens",
  "set.mode.cost": "仅费用",
  "set.mode.limit": "最紧的限额窗口",
  "set.chipPeriod": "统计范围",
  "set.period.today": "今日",
  "set.period.7d": "近 7 天",
  "set.period.month": "本月",
  "set.logo": "CC GUI 标志",
  "set.logoDesc": "使用 CC GUI 应用图标作状态栏标记，关闭后显示线性图标。",
  "set.motion": "运行时动画",
  "set.motionDesc": "有会话运行时轻微起伏、空闲时偶尔眨眼；系统开启「减少动态效果」时始终静止。",
  "set.chipLimits": "状态栏限额",
  "set.chipLimitsDesc": "在用量后面常驻显示每个平台的 5 小时与每周窗口（带平台图标）；达到提醒阈值时变成告警色。",
  "set.limits": "限额",
  "set.autoRefresh": "自动刷新",
  "set.autoRefreshDesc": "状态栏限额标签、弹层或限额页可见时按此间隔刷新；一轮对话结束时也会立刻补一次。",
  "set.every": "每 {n} 分钟",
  "set.off": "关闭",
  "set.claude": "Claude",
  "set.claudeDesc": "读取 Claude Code 的本机登录（macOS 钥匙串 / ~/.claude/.credentials.json），只请求 api.anthropic.com。",
  "set.codex": "Codex",
  "set.codexDesc": "读取 ~/.codex/auth.json，只请求 chatgpt.com。",
  "set.alerts": "接近上限时提醒",
  "set.alertsDesc": "达到阈值时在状态栏与侧栏标记；系统通知待宿主开放后补上。",
  "set.background": "后台查询",
  "set.backgroundDesc": "状态栏不显示限额时，关闭面板后仍每 15 分钟查一次，让告急标记保持最新。",
  "set.sources": "数据来源",
  "set.include": "统计 {name}",
  "set.excludeNote": "关闭某个来源只会在本插件的统计里隐藏它，宿主仍会读取该目录。",
  "set.rescan": "重新扫描",
  "set.rescanDesc": "重建本地索引；不改动各 CLI 的原始日志。目录会跟随 CLAUDE_CONFIG_DIR、CODEX_HOME 等环境变量。",
  "set.prices": "价格",
  "set.priceTable": "价格表",
  "set.priceBundled": "内置快照 · {date} · {n} 个模型",
  "set.priceOnline": "在线价格表 · {date} · {n} 个模型",
  "set.priceUpdatedAt": "上次更新 {at}",
  "set.updateNow": "立即更新",
  "set.priceAuto": "自动更新价格表",
  "set.priceAutoDesc": "每 24 小时从 GitHub 下载 LiteLLM 的公开价格表，只下载、不上传；失败时沿用上一次。",
  "set.priceLastError": "上次自动更新失败：{error}",
  "set.priceError": "读取价格表信息失败：{error}",
  "set.priceUpdateError": "更新价格表失败：{error}",
  "set.noPrice": "没有价格的模型",
  "set.noPriceDesc": "这些模型的用量不计入费用，也不会拿别的模型价格去猜。",
  "set.noPriceNone": "无",
  "set.privacy": "隐私与来源",
  "set.privacy1": "用量统计完全在本机完成，不上传任何数据（自动更新价格表只下载公开文件）。",
  "set.privacy2": "查询限额时使用本机 CLI 已有的登录凭据，只发往对应厂商的官方接口。凭据只在 CC GUI 主进程里使用，插件拿不到。",
  "set.privacy3": "交互与信息架构参考了 {tokentracker}（MIT © 2026 xiufengsun）；视觉、文案与代码为本插件原创，状态栏标记使用 CC GUI 应用图标，平台图标归各平台所有。完整声明见插件仓库的 {notices}。",
  "set.saveError": "设置未能保存：{error}"
};

// src/i18n/index.ts
function langOf(locale) {
  return /^zh/i.test(String(locale ?? "")) ? "zh" : "en";
}
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => k in params ? String(params[k]) : m);
}
function templateParts(template) {
  const out = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) out.push({ text: template.slice(last, m.index), key: null });
    out.push({ text: m[0], key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last), key: null });
  return out;
}
function createT(lang) {
  const table = lang === "zh" ? zh : en;
  const raw = (key) => table[key] ?? zh[key] ?? key;
  return { t: (key, params) => interpolate(raw(key), params), raw };
}

// src/shim/jsx-runtime.ts
function jsx(type, props, key) {
  return createElement(type, key == null ? props : { ...props, key });
}
function jsxs(type, props, key) {
  const { children: children2, ...rest } = props;
  if (!Array.isArray(children2)) return jsx(type, props, key);
  return createElement(type, key == null ? rest : { ...rest, key }, ...children2);
}

// src/ui/app.tsx
var AppContext = null;
function initAppContext() {
  if (!AppContext) AppContext = createContext(null);
}
function AppProvider({ app, children: children2 }) {
  if (!AppContext) throw new Error("initAppContext() must run before rendering");
  return /* @__PURE__ */ jsx(AppContext.Provider, { value: app, children: children2 });
}
function useApp() {
  const app = AppContext ? useContext(AppContext) : null;
  if (!app) throw new Error("useApp() outside <AppProvider>");
  return app;
}

// src/ui/hooks.ts
function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
function useNow(intervalMs = 3e4) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
var escStack = [];
function onEscape(event) {
  if (event.key !== "Escape" || !escStack.length) return;
  event.stopPropagation();
  escStack[escStack.length - 1].run();
}
function useEscape(active, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return void 0;
    const entry = { run: () => ref.current() };
    escStack.push(entry);
    if (escStack.length === 1) document.addEventListener("keydown", onEscape, true);
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
      if (!escStack.length) document.removeEventListener("keydown", onEscape, true);
    };
  }, [active]);
}
function useDismiss(refs, active, onDismiss) {
  const handler = useRef(onDismiss);
  handler.current = onDismiss;
  useEffect(() => {
    if (!active) return void 0;
    const onDown = (event) => {
      const target = event.target;
      if (target && refs.some((r) => r.current?.contains(target))) return;
      handler.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active]);
}
function isShown(el) {
  if (!el || !el.isConnected || document.visibilityState === "hidden") return false;
  const check = el.checkVisibility;
  if (typeof check === "function") return check.call(el, { visibilityProperty: true });
  return getComputedStyle(el).visibility !== "hidden" && el.getClientRects().length > 0;
}
function useElementVisible(ref, pollMs = 1500) {
  const [visible, setVisible] = useState(false);
  const update = useCallback(() => setVisible(isShown(ref.current)), [ref]);
  useEffect(() => {
    update();
    const id = setInterval(update, pollMs);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [update, pollMs]);
  return visible;
}

// src/ui/derive.ts
function useAll(app) {
  const prefsState = useStore(app.prefs.store);
  const usage = useStore(app.usage.store);
  const limits = useStore(app.limits.store);
  return { prefs: prefsState.prefs, prefsState, usage, limits };
}
function computeAlert(prefs, limits) {
  return limitAlert(limits.providers, enabledProviders(prefs), prefs.alerts);
}
function useAlert(prefs, limits) {
  return useMemo(() => computeAlert(prefs, limits), [prefs, limits]);
}
function useProviderTags(prefs, limits) {
  return useMemo(() => providerTags(limits.providers, enabledProviders(prefs), prefs.alerts), [prefs, limits]);
}
function useChipTotals(prefs, usage) {
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
function scanPct(usage) {
  const p2 = usage.progress;
  return p2 && p2.total > 0 ? Math.min(100, Math.round(p2.done / p2.total * 100)) : 0;
}
function isEmpty(usage) {
  return usage.phase === "ready" && !usage.scanning && !usage.firstDay;
}
function anyProviderFailed(limits) {
  return limits.providers.some((p2) => p2.status === "offline" || p2.status === "rateLimited" || p2.status === "error");
}

// src/ui/icons.tsx
var p = (d) => ["path", { d }];
var SHAPES = {
  refresh: [p("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"), p("M21 3v5h-5"), p("M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"), p("M8 16H3v5")],
  check: [p("M20 6 9 17l-5-5")],
  sliders: [p("M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4")],
  bell: [p("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"), p("M10.3 21a1.94 1.94 0 0 0 3.4 0")],
  bellOff: [p("M10.3 21a1.94 1.94 0 0 0 3.4 0"), p("M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"), p("M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"), p("m2 2 20 20")],
  chevD: [p("m6 9 6 6 6-6")],
  chevL: [p("m15 18-6-6 6-6")],
  chevR: [p("m9 18 6-6-6-6")],
  x: [p("M18 6 6 18"), p("m6 6 12 12")],
  info: [["circle", { cx: 12, cy: 12, r: 10 }], p("M12 16v-4"), p("M12 8h.01")],
  copy: [["rect", { x: 8, y: 8, width: 14, height: 14, rx: 2 }], p("M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2")],
  cal: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], p("M16 2v4M8 2v4M3 10h18")],
  db: [["ellipse", { cx: 12, cy: 5, rx: 9, ry: 3 }], p("M3 5v14a9 3 0 0 0 18 0V5"), p("M3 12a9 3 0 0 0 18 0")],
  alert: [p("m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"), p("M12 9v4M12 17h.01")],
  loader: [p("M21 12a9 9 0 1 1-6.219-8.56")],
  arrowR: [p("M5 12h14"), p("m12 5 7 7-7 7")],
  gauge: [p("m12 14 4-4"), p("M3.34 19a10 10 0 1 1 17.32 0")],
  term: [p("m4 17 6-6-6-6"), p("M12 19h8")],
  link: [p("M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"), p("M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71")]
};
function Icon({ name, size = 16, className, ...rest }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className,
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      ...rest,
      children: SHAPES[name].map(([tag, attrs], i) => {
        const Tag = tag;
        return /* @__PURE__ */ jsx(Tag, { ...attrs }, i);
      })
    }
  );
}
function GaugeIcon({ className }) {
  return /* @__PURE__ */ jsx(Icon, { name: "gauge", className });
}

// vendor/plugin-ui/src/cx.ts
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// vendor/plugin-ui/src/components/Button.tsx
var Button = forwardRef(function Button2({ variant = "secondary", size = "md", className, type, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      ref,
      type: type ?? "button",
      className: cx("pui-btn", `pui-btn-${variant}`, size === "sm" && "pui-btn-sm", className),
      ...rest
    }
  );
});

// vendor/plugin-ui/src/components/Input.tsx
var Input = forwardRef(function Input2({ invalid, className, spellCheck, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    "input",
    {
      ref,
      spellCheck: spellCheck ?? false,
      className: cx("pui-input", invalid && "pui-input-invalid", className),
      ...rest
    }
  );
});
var Textarea = forwardRef(function Textarea2({ invalid, className, spellCheck, ...rest }, ref) {
  return /* @__PURE__ */ jsx(
    "textarea",
    {
      ref,
      spellCheck: spellCheck ?? false,
      className: cx("pui-textarea", invalid && "pui-input-invalid", className),
      ...rest
    }
  );
});

// vendor/plugin-ui/src/components/Select.tsx
var Select = forwardRef(function Select2({ className, children: children2, ...rest }, ref) {
  return /* @__PURE__ */ jsxs("span", { className: cx("pui-select-wrap", className), children: [
    /* @__PURE__ */ jsx("select", { ref, className: "pui-select", ...rest, children: children2 }),
    /* @__PURE__ */ jsx(
      "svg",
      {
        className: "pui-select-chevron",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
        children: /* @__PURE__ */ jsx("path", { d: "m6 9 6 6 6-6" })
      }
    )
  ] });
});

// vendor/plugin-ui/src/components/Badge.tsx
function Badge({ tone = "neutral", className, ...rest }) {
  return /* @__PURE__ */ jsx("span", { className: cx("pui-badge", `pui-badge-${tone}`, className), ...rest });
}

// src/ui/ChartTip.tsx
var tipStore = createStore({ content: null, rect: null });
function showTip(el, content) {
  const r = el.getBoundingClientRect();
  tipStore.set(() => ({ content, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } }));
}
function hideTip() {
  tipStore.set((s) => s.content ? { content: null, rect: null } : s);
}
function tipHandlers(content) {
  return {
    onMouseEnter: (e) => showTip(e.currentTarget, content()),
    onMouseLeave: hideTip,
    onFocus: (e) => showTip(e.currentTarget, content()),
    onBlur: hideTip
  };
}
function ChartTip() {
  const { content, rect } = useStore(tipStore);
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!rect || !ref.current) {
      setPos(null);
      return;
    }
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
    const top = rect.top - h - 8 < 8 ? rect.bottom + 8 : rect.top - h - 8;
    setPos({ left, top });
  }, [rect, content]);
  useLayoutEffect(() => hideTip, []);
  if (!content) return null;
  return /* @__PURE__ */ jsx("div", { ref, className: "ul-tip", role: "tooltip", style: pos ? { left: pos.left, top: pos.top } : { visibility: "hidden", left: 0, top: 0 }, children: content });
}

// src/ui/controls.tsx
function Segmented({
  value,
  options,
  onChange,
  label,
  size = "sm",
  role = "radiogroup",
  className
}) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  return /* @__PURE__ */ jsx("div", { className: cx("ul-seg", `ul-seg--${size}`, className), role, "aria-label": label, children: options.map((o) => {
    const on = o.value === value;
    return /* @__PURE__ */ jsxs(
      "button",
      {
        ref: o.anchorRef,
        type: "button",
        role: itemRole,
        ...role === "tablist" ? { "aria-selected": on } : { "aria-checked": on },
        className: cx("ul-seg__item", on && "is-on"),
        onClick: () => onChange(o.value),
        children: [
          o.icon && /* @__PURE__ */ jsx(Icon, { name: o.icon, size: 13 }),
          o.label,
          o.badge
        ]
      },
      o.value
    );
  }) });
}
function Switch({ checked, onChange, label, disabled }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      disabled,
      className: cx("ul-switch", checked && "is-on"),
      onClick: () => onChange(!checked),
      children: /* @__PURE__ */ jsx("i", {})
    }
  );
}
function ThresholdChips({ value, onChange, disabled }) {
  const { t } = useApp();
  return /* @__PURE__ */ jsx("div", { className: "ul-tchips", role: "group", "aria-label": t("bell.thresholds"), children: THRESHOLD_CHOICES.map((v) => {
    const on = value.includes(v);
    return /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: cx("ul-tchip", on && "is-on"),
        "aria-pressed": on,
        disabled,
        onClick: () => onChange(toggleThreshold(value, v)),
        children: [
          v,
          "%"
        ]
      },
      v
    );
  }) });
}
function InfoTip({ text }) {
  return /* @__PURE__ */ jsx("span", { className: "ul-info", tabIndex: 0, role: "note", "aria-label": text, title: text, children: /* @__PURE__ */ jsx(Icon, { name: "info", size: 13 }) });
}
function InlineAlert({
  message,
  onRetry,
  retrying,
  className
}) {
  const { t } = useApp();
  return /* @__PURE__ */ jsxs("div", { className: cx("ul-alert", className), role: "alert", children: [
    /* @__PURE__ */ jsx(Icon, { name: "alert", size: 14 }),
    /* @__PURE__ */ jsx("span", { className: "ul-alert__text", children: message }),
    onRetry && /* @__PURE__ */ jsx(Button, { size: "sm", variant: "secondary", disabled: retrying, "aria-busy": retrying || void 0, onClick: onRetry, children: retrying ? t("common.retrying") : t("common.retry") })
  ] });
}
function Spinner({ size = 14 }) {
  return /* @__PURE__ */ jsx(Icon, { name: "loader", size, className: "ul-spin" });
}
function Collapse({ open, children: children2, id }) {
  return /* @__PURE__ */ jsx("div", { id, className: cx("ul-collapse", open && "is-open"), "aria-hidden": !open || void 0, ...open ? {} : { inert: "" }, children: /* @__PURE__ */ jsx("div", { className: "ul-collapse__in", children: children2 }) });
}
function EngineDot({ color }) {
  return /* @__PURE__ */ jsx("i", { className: "ul-edot", style: { background: color }, "aria-hidden": "true" });
}

// src/ui/feedback.tsx
var SPIN_MS = 600;
var SUCCESS_MS = 900;
var COPY_FEEDBACK_MS = 1500;
function useTimers() {
  const timers = useRef([]);
  const clear = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);
  useEffect(() => clear, [clear]);
  const later = useCallback((fn, ms) => {
    timers.current = [...timers.current, setTimeout(fn, ms)];
  }, []);
  return { clear, later };
}
function lapRemainder(elapsed) {
  return elapsed < SPIN_MS ? SPIN_MS - elapsed : (SPIN_MS - elapsed % SPIN_MS) % SPIN_MS;
}
function useActionFeedback() {
  const [feedback, setFeedback] = useState("idle");
  const { clear, later } = useTimers();
  const run = useCallback(
    async (action) => {
      clear();
      setFeedback("running");
      const started = performance.now();
      let ok = true;
      try {
        await action();
      } catch {
        ok = false;
      }
      later(() => {
        setFeedback(ok ? "success" : "idle");
        if (ok) later(() => setFeedback("idle"), SUCCESS_MS);
      }, lapRemainder(performance.now() - started));
      return ok;
    },
    [clear, later]
  );
  return { feedback, run };
}
function useRunningFeedback(running, failed) {
  const [feedback, setFeedback] = useState(running ? "running" : "idle");
  const startedAt = useRef(0);
  const wasRunning = useRef(running);
  const { clear, later } = useTimers();
  const failedRef = useRef(failed);
  failedRef.current = failed;
  useEffect(() => {
    if (running) {
      clear();
      startedAt.current = performance.now();
      wasRunning.current = true;
      setFeedback("running");
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    later(() => {
      const ok = !failedRef.current;
      setFeedback(ok ? "success" : "idle");
      if (ok) later(() => setFeedback("idle"), SUCCESS_MS);
    }, lapRemainder(performance.now() - startedAt.current));
  }, [running, clear, later]);
  return feedback;
}
function FeedbackIcon({ icon, feedback, size = 16 }) {
  return /* @__PURE__ */ jsxs("span", { className: cx("ul-fb", feedback === "running" && "is-running", feedback === "success" && "is-done"), "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx(Icon, { name: icon, size, className: "ul-fb__icon" }),
    /* @__PURE__ */ jsx(Icon, { name: "check", size, className: "ul-fb__check" })
  ] });
}
function RefreshButton({
  onRefresh,
  label,
  feedback: external,
  size = "md"
}) {
  const { t } = useApp();
  const action = useActionFeedback();
  const feedback = action.feedback !== "idle" ? action.feedback : external ?? "idle";
  const name = label ?? t("common.refresh");
  return /* @__PURE__ */ jsx(
    Button,
    {
      variant: "ghost",
      size,
      className: "ul-icon-btn",
      "aria-label": name,
      title: name,
      "aria-busy": feedback === "running" || void 0,
      disabled: feedback === "running",
      onClick: () => void action.run(onRefresh),
      children: /* @__PURE__ */ jsx(FeedbackIcon, { icon: "refresh", feedback, size: size === "sm" ? 14 : 16 })
    }
  );
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}
function CopyButton({ text, label, copiedLabel }) {
  const { t } = useApp();
  const [state, setState] = useState("idle");
  const { clear, later } = useTimers();
  const name = state === "done" ? copiedLabel ?? t("common.copied") : label ?? t("common.copy");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        size: "sm",
        className: "ul-icon-btn",
        "aria-label": name,
        title: name,
        onClick: () => {
          clear();
          copyText(text).then(
            () => {
              setState("done");
              later(() => setState("idle"), COPY_FEEDBACK_MS);
            },
            () => setState("failed")
          );
        },
        children: /* @__PURE__ */ jsx(FeedbackIcon, { icon: "copy", feedback: state === "done" ? "success" : "idle", size: 14 })
      }
    ),
    state === "failed" && /* @__PURE__ */ jsx("span", { className: "ul-inline-error", role: "alert", children: t("common.copyFailed") })
  ] });
}

// src/ui/page/limits/BellLayer.tsx
function BellLayer({ anchorRef }) {
  const app = useApp();
  const { t } = app;
  const { prefs } = useAll(app);
  const ref = useRef(null);
  const close = () => app.view.set((s) => s.layer === "bell" ? { ...s, layer: null } : s);
  useDismiss([ref, anchorRef], true, close);
  useEscape(true, close);
  const setAlerts = (patch) => app.prefs.update((p2) => ({ ...p2, alerts: { ...p2.alerts, ...patch } }));
  return /* @__PURE__ */ jsxs("div", { ref, className: "ul-layer ul-layer--bell", role: "dialog", "aria-label": t("bell.label"), children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-layer__head ul-layer__head--row", children: [
      /* @__PURE__ */ jsx("b", { children: t("bell.title") }),
      /* @__PURE__ */ jsx(Switch, { checked: prefs.alerts.on, label: t("bell.title"), onChange: (on) => setAlerts({ on }) })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "ul-layer__p", children: t("bell.desc") }),
    /* @__PURE__ */ jsx("div", { className: "ul-layer__pad", children: /* @__PURE__ */ jsx(ThresholdChips, { value: prefs.alerts.thresholds, disabled: !prefs.alerts.on, onChange: (thresholds) => setAlerts({ thresholds }) }) }),
    /* @__PURE__ */ jsxs("div", { className: "ul-layer__row", children: [
      /* @__PURE__ */ jsx("span", { children: t("bell.chip") }),
      /* @__PURE__ */ jsx(Switch, { checked: prefs.chipLimits, label: t("bell.chip"), onChange: (chipLimits) => app.prefs.update((p2) => ({ ...p2, chipLimits })) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ul-layer__row", children: [
      /* @__PURE__ */ jsx("span", { children: t("bell.background") }),
      /* @__PURE__ */ jsx(Switch, { checked: prefs.alerts.background, label: t("bell.background"), onChange: (background) => setAlerts({ background }) })
    ] })
  ] });
}

// src/domain/format.ts
var trim1 = (x) => String(Math.round(x * 10) / 10);
function tokens(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${trim1(n / 1e9)}B`;
  if (a >= 1e6) return `${trim1(n / 1e6)}M`;
  if (a >= 1e3) return `${trim1(n / 1e3)}K`;
  return String(Math.round(n));
}
function int(n) {
  return Math.round(n).toLocaleString("en-US");
}
function usd(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n > 0 && n < 0.01) return "<$0.01";
  if (n >= 1e3) return `$${int(n)}`;
  return `$${n.toFixed(2)}`;
}
function share(x) {
  if (x > 0 && x < 1e-4) return "<0.01%";
  const p2 = x * 100;
  return `${p2 >= 10 ? p2.toFixed(1) : p2.toFixed(2)}%`;
}
function pct(x) {
  return `${Math.round(x * 100)}%`;
}
function rate(x) {
  return `${trim1(x * 100)}%`;
}
var minutesOf = (ms) => Math.max(0, Math.round(ms / 6e4));
function durShort(ms) {
  const m = minutesOf(ms);
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor(m % 1440 / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}
function durLong(ms, lang) {
  const m = minutesOf(ms);
  const zh2 = lang === "zh";
  if (m >= 1440) {
    const d = Math.floor(m / 1440);
    const h = Math.floor(m % 1440 / 60);
    if (zh2) return `${d} 天${h ? ` ${h} 小时` : ""}`;
    return `${d} d${h ? ` ${h} h` : ""}`;
  }
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (zh2) return `${h} 小时${rest ? ` ${rest} 分` : ""}`;
    return `${h} h${rest ? ` ${rest} min` : ""}`;
  }
  return zh2 ? `${Math.max(1, m)} 分钟` : `${Math.max(1, m)} min`;
}
function ago(ms, lang) {
  if (ms == null) return "";
  const zh2 = lang === "zh";
  if (ms < 3e4) return zh2 ? "刚刚" : "just now";
  if (ms < 36e5) return zh2 ? `${Math.round(ms / 6e4)} 分钟前` : `${Math.round(ms / 6e4)} min ago`;
  if (ms < 864e5) return zh2 ? `${Math.round(ms / 36e5)} 小时前` : `${Math.round(ms / 36e5)} h ago`;
  return zh2 ? `${Math.round(ms / 864e5)} 天前` : `${Math.round(ms / 864e5)} d ago`;
}
var EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var ZH_WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
var EN_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var pad2 = (n) => String(n).padStart(2, "0");
function dateShort(key, lang) {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getMonth() + 1}月${d.getDate()}日` : `${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function dateWeek(key, lang) {
  const d = fromKey(key);
  return lang === "zh" ? `${dateShort(key, lang)} ${ZH_WEEK[d.getDay()]}` : `${EN_WEEK[d.getDay()]}, ${dateShort(key, lang)}`;
}
function monthLabel(key, lang) {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function monthShort(key, lang) {
  const d = fromKey(key);
  return lang === "zh" ? `${d.getMonth() + 1}月` : EN_MONTHS[d.getMonth()];
}
function yearLabel(key, lang) {
  return lang === "zh" ? `${key.slice(0, 4)}年` : key.slice(0, 4);
}
function dateRange(from, to, lang) {
  return `${dateShort(from, lang)} – ${dateShort(to, lang)}`;
}
function hourRange(h) {
  return `${pad2(h)}:00–${pad2((h + 1) % 24 === 0 ? 24 : h + 1)}:00`;
}
function clock(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function resetAt(ts, now, lang) {
  const dd = daysBetween(keyOf(new Date(now)), keyOf(new Date(ts)));
  const hm = clock(ts);
  if (dd === 0) return lang === "zh" ? `今天 ${hm}` : `today ${hm}`;
  if (dd === 1) return lang === "zh" ? `明天 ${hm}` : `tomorrow ${hm}`;
  return `${dateWeek(keyOf(new Date(ts)), lang)} ${hm}`;
}
function stamp(ts) {
  const d = new Date(ts);
  return `${keyOf(d)} ${clock(ts)}`;
}

// src/ui/ProviderMark.tsx
var CLAUDE = "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z";
var OPENAI = "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z";
function ProviderMark({ id, size = 16 }) {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor", "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ jsx("path", { d: id === "claude" ? CLAUDE : OPENAI }) });
}

// src/ui/limit-ui.tsx
var PROVIDER_NAME = { claude: "Claude", codex: "Codex" };
var PROVIDER_CLI = { claude: "Claude Code", codex: "Codex" };
var PROVIDER_BRAND = { claude: "#d97757", codex: "#10a37f" };
function ProviderLogo({ id, size = 18 }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: "ul-plogo",
      style: {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        ["--ul-c"]: PROVIDER_BRAND[id]
      },
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx(ProviderMark, { id, size: Math.round(size * 0.64) })
    }
  );
}
function windowLabel(w, t) {
  const info = windowInfo(w);
  if (info.weekly && !info.model) return t("lim.weekly");
  const span = info.span ? t(info.span.unit === "h" ? "lim.hours" : "lim.days", { n: info.span.n }) : w.label ?? w.id;
  return info.model ? t("lim.scoped", { span, model: info.model }) : span;
}
function paceText(p2, t, lang) {
  switch (p2.kind) {
    case "idle":
      return t("lim.paceIdle");
    case "early":
      return t("lim.paceEarly");
    case "unknown":
      return t("lim.paceUnknown");
    case "exhausted":
      return t("lim.paceExhausted");
    case "ok":
      return t("lim.paceOk", { v: pct(Math.min(p2.projected, 1)) });
    default:
      return t("lim.paceOver", { runOut: durLong(p2.runOutMs, lang), early: durLong(p2.earlyMs, lang) });
  }
}
function LimitTip({ provider, now, pos }) {
  const { t, lang } = useApp();
  return /* @__PURE__ */ jsxs("span", { className: cx("ul-ltip", pos.above && "is-above"), role: "tooltip", style: { left: pos.left, top: pos.top }, children: [
    /* @__PURE__ */ jsxs("b", { className: "ul-ltip__head", children: [
      PROVIDER_NAME[provider.id],
      provider.plan ? ` ${provider.plan}` : ""
    ] }),
    provider.windows.map((w) => /* @__PURE__ */ jsxs("span", { className: "ul-ltip__row", children: [
      /* @__PURE__ */ jsx("span", { className: "ul-ltip__win", children: windowInfo(w).short }),
      /* @__PURE__ */ jsx("span", { children: paceText(pace(w, now), t, lang) }),
      w.resetsAt != null && /* @__PURE__ */ jsxs("span", { className: "ul-ltip__reset", children: [
        "· ",
        t("lim.resetAt", { at: resetAt(w.resetsAt, now, lang) })
      ] })
    ] }, w.id)),
    /* @__PURE__ */ jsx("span", { className: "ul-ltip__sep" }),
    /* @__PURE__ */ jsx("span", { className: "ul-ltip__note", children: t("lim.tipNote") }),
    provider.fetchedAt != null && /* @__PURE__ */ jsxs("span", { className: "ul-ltip__foot", children: [
      t("lim.updated", { ago: ago(now - provider.fetchedAt, lang) }),
      " · ",
      resetAt(provider.fetchedAt, now, lang)
    ] })
  ] });
}
function LimitBar({ w, p: p2, label, extraClass }) {
  const { t } = useApp();
  const g = barGeometry(w.usedPercent, p2.marker);
  const level = barLevel(g.used);
  return /* @__PURE__ */ jsxs(
    "span",
    {
      className: cx("ul-bar", `is-${level}`, extraClass),
      role: "meter",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": g.used,
      "aria-label": t("lim.barAria", { label, v: g.used }),
      children: [
        /* @__PURE__ */ jsx("i", { className: "ul-bar__fill", style: { width: `${g.used}%` } }),
        g.tick != null && /* @__PURE__ */ jsx("i", { className: cx("ul-bar__tick", p2.kind === "over" && "is-over"), style: { left: `${g.tick}%` } })
      ]
    }
  );
}
function LimitRow({
  provider,
  w,
  now,
  compact,
  stale
}) {
  const { t, lang } = useApp();
  const [tip, setTip] = useState(null);
  const p2 = pace(w, now);
  const info = windowInfo(w);
  const label = windowLabel(w, t);
  const used = barGeometry(w.usedPercent, p2.marker).used;
  const level = barLevel(used);
  const remaining = w.resetsAt == null ? null : Math.max(0, w.resetsAt - now);
  const hover = {
    onMouseEnter: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const above = r.top > 220;
      setTip({ above, left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - 336)), top: above ? r.top - 8 : r.bottom + 8 });
    },
    onMouseLeave: () => setTip(null)
  };
  const card = tip && /* @__PURE__ */ jsx(LimitTip, { provider, now, pos: tip });
  if (compact) {
    return /* @__PURE__ */ jsxs("div", { className: cx("ul-lrow ul-lrow--c", stale && "is-stale"), ...hover, children: [
      /* @__PURE__ */ jsx("span", { className: "ul-lrow__lbl", children: info.short }),
      /* @__PURE__ */ jsx(LimitBar, { w, p: p2, label }),
      /* @__PURE__ */ jsxs("span", { className: cx("ul-lrow__pct", `is-${level}`), children: [
        used,
        "%"
      ] }),
      /* @__PURE__ */ jsx("span", { className: "ul-lrow__reset", children: remaining == null ? "—" : durShort(remaining) }),
      card
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: cx("ul-lrow", stale && "is-stale"), ...hover, children: [
    /* @__PURE__ */ jsxs("span", { className: "ul-lrow__lbl", children: [
      label,
      info.model && /* @__PURE__ */ jsx(Badge, { tone: "neutral", className: "ul-tag", children: t("lim.modelTag") })
    ] }),
    /* @__PURE__ */ jsx(LimitBar, { w, p: p2, label }),
    /* @__PURE__ */ jsxs("span", { className: cx("ul-lrow__pct", `is-${level}`), children: [
      used,
      "%",
      /* @__PURE__ */ jsx("small", { children: t("common.used") })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "ul-lrow__reset", children: remaining == null ? "—" : t("lim.resetIn", { dur: durLong(remaining, lang) }) }),
    /* @__PURE__ */ jsx("p", { className: cx("ul-lrow__pace", `is-${p2.kind}`), children: paceText(p2, t, lang) }),
    card
  ] });
}
function ExtraRow({ extra, stale }) {
  const { t } = useApp();
  const share2 = extra.limitUsd > 0 ? Math.min(100, extra.usedUsd / extra.limitUsd * 100) : 0;
  return /* @__PURE__ */ jsxs("div", { className: cx("ul-lrow ul-lrow--extra", stale && "is-stale"), children: [
    /* @__PURE__ */ jsx("span", { className: "ul-lrow__lbl", children: t("lim.extra") }),
    /* @__PURE__ */ jsx(
      "span",
      {
        className: "ul-bar ul-bar--extra",
        role: "meter",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(share2),
        "aria-label": `${t("lim.extra")} ${usd(extra.usedUsd)} / ${usd(extra.limitUsd)}`,
        children: /* @__PURE__ */ jsx("i", { className: "ul-bar__fill", style: { width: `${share2}%` } })
      }
    ),
    /* @__PURE__ */ jsxs("span", { className: "ul-lrow__pct", children: [
      usd(extra.usedUsd),
      /* @__PURE__ */ jsxs("small", { children: [
        "/ ",
        usd(extra.limitUsd)
      ] })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "ul-lrow__reset", children: t("lim.extraMonth") }),
    /* @__PURE__ */ jsx("p", { className: "ul-lrow__pace", children: t("lim.extraDesc") })
  ] });
}

// src/ui/page/limits/ProviderCard.tsx
function Banner({ tone, children: children2, action }) {
  return /* @__PURE__ */ jsxs("div", { className: cx("ul-banner", `is-${tone}`), role: tone === "error" ? "alert" : "status", children: [
    /* @__PURE__ */ jsx(Icon, { name: "alert", size: 14 }),
    /* @__PURE__ */ jsx("span", { children: children2 }),
    action
  ] });
}
function LoginState({ p: p2 }) {
  const { t } = useApp();
  const cmd = loginCommand(p2.id);
  const signedOut = p2.status === "signedOut";
  return /* @__PURE__ */ jsxs("div", { className: "ul-lstate", children: [
    /* @__PURE__ */ jsx("p", { className: "ul-lstate__title", children: t(signedOut ? "lim.signedOutTitle" : "lim.expiredTitle", { name: PROVIDER_CLI[p2.id] }) }),
    /* @__PURE__ */ jsx("p", { className: "ul-lstate__desc", children: t(signedOut ? "lim.signedOutDesc" : "lim.expiredDesc") }),
    /* @__PURE__ */ jsxs("div", { className: "ul-cmd", children: [
      /* @__PURE__ */ jsx(Icon, { name: "term", size: 14 }),
      /* @__PURE__ */ jsx("code", { children: cmd }),
      /* @__PURE__ */ jsx(CopyButton, { text: cmd })
    ] })
  ] });
}
function ProviderBody({ p: p2, now }) {
  const app = useApp();
  const { t, lang } = app;
  const { limits } = useAll(app);
  if (p2.status === "signedOut" || p2.status === "expired") return /* @__PURE__ */ jsx(LoginState, { p: p2 });
  const retrying = !!limits.retrying[p2.id];
  const retry = /* @__PURE__ */ jsx(Button, { size: "sm", variant: "secondary", disabled: retrying, "aria-busy": retrying || void 0, onClick: () => void app.limits.retry(p2.id).catch(() => void 0), children: retrying ? t("common.retrying") : t("common.retry") });
  const age = p2.fetchedAt == null ? null : ago(now - p2.fetchedAt, lang);
  const withData = hasWindows(p2);
  let banner = null;
  if (p2.status === "rateLimited") {
    banner = /* @__PURE__ */ jsx(Banner, { tone: "warn", children: p2.retryAt != null && p2.retryAt > now ? t("lim.rateLimited", { ago: age ?? "—", retry: durLong(p2.retryAt - now, lang) }) : t("lim.rateLimitedNoRetry", { ago: age ?? "—" }) });
  } else if (p2.status === "offline") {
    banner = /* @__PURE__ */ jsx(Banner, { tone: "error", action: retry, children: withData && age ? t("lim.offline", { host: p2.host, ago: age }) : t("lim.offlineNoData", { host: p2.host }) });
  } else if (p2.status === "error") {
    banner = /* @__PURE__ */ jsx(Banner, { tone: "error", action: retry, children: t("lim.error", { error: p2.error ?? "" }) });
  }
  const stale = isStale(p2);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    banner,
    withData && /* @__PURE__ */ jsxs("div", { className: "ul-pcard__rows", children: [
      p2.windows.map((w) => /* @__PURE__ */ jsx(LimitRow, { provider: p2, w, now, stale }, w.id)),
      p2.extra && /* @__PURE__ */ jsx(ExtraRow, { extra: p2.extra, stale })
    ] }),
    p2.id === "codex" && withData && isWeeklyOnly(p2) && /* @__PURE__ */ jsx("p", { className: "ul-pcard__note", children: p2.plan ? t("lim.weeklyOnly", { plan: p2.plan }) : t("lim.weeklyOnlyNoPlan") })
  ] });
}
function ProviderCard({ p: p2, now }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs } = useAll(app);
  const collapsed = !!prefs.collapsed[p2.id];
  const bodyId = `ul-prov-${p2.id}`;
  const meta = p2.fetchedAt != null ? t("lim.updated", { ago: ago(now - p2.fetchedAt, lang) }) : "";
  return /* @__PURE__ */ jsxs("section", { className: cx("ul-pcard-lg", collapsed && "is-collapsed"), children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "ul-pcard-lg__head",
        "aria-expanded": !collapsed,
        "aria-controls": bodyId,
        onClick: () => app.prefs.update((pr) => ({ ...pr, collapsed: { ...pr.collapsed, [p2.id]: !collapsed } })),
        children: [
          /* @__PURE__ */ jsx(ProviderLogo, { id: p2.id, size: 22 }),
          /* @__PURE__ */ jsx("b", { children: PROVIDER_NAME[p2.id] }),
          p2.plan && /* @__PURE__ */ jsx(Badge, { tone: "neutral", children: p2.plan }),
          /* @__PURE__ */ jsx("span", { className: "ul-pcard-lg__meta", children: meta }),
          /* @__PURE__ */ jsx(Icon, { name: "chevD", className: "ul-pcard-lg__chev" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(Collapse, { open: !collapsed, id: bodyId, children: /* @__PURE__ */ jsx("div", { className: "ul-pcard-lg__body", children: /* @__PURE__ */ jsx(ProviderBody, { p: p2, now }) }) })
  ] });
}
function ProviderSkeleton({ id }) {
  const { t } = useApp();
  return /* @__PURE__ */ jsxs("section", { className: "ul-pcard-lg", "aria-busy": "true", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-pcard-lg__head is-static", children: [
      /* @__PURE__ */ jsx(ProviderLogo, { id, size: 22 }),
      /* @__PURE__ */ jsx("b", { children: PROVIDER_NAME[id] }),
      /* @__PURE__ */ jsx("span", { className: "ul-pcard-lg__meta", children: t("lim.loading") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ul-pcard-lg__body", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--lrow" }),
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--lrow" })
    ] })
  ] });
}

// src/ui/page/limits/LimitsPage.tsx
function LimitsPage() {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const now = useNow(3e4);
  const enabled = enabledProviders(prefs);
  const hidden = PROVIDER_IDS.filter((id) => !prefs.providers[id]).map((id) => PROVIDER_NAME[id]);
  const loading = limits.phase === "idle" || limits.phase === "loading";
  return /* @__PURE__ */ jsxs("div", { className: "ul-lim", children: [
    /* @__PURE__ */ jsx("p", { className: "ul-lim__intro", children: t("lim.intro") }),
    limits.error && /* @__PURE__ */ jsx(
      InlineAlert,
      {
        message: t("lim.loadError", { error: limits.error }),
        retrying: limits.fetching,
        onRetry: () => void app.limits.fetch(true).catch(() => void 0)
      }
    ),
    enabled.map((id) => {
      const p2 = limits.providers.find((x) => x.id === id);
      if (p2) return /* @__PURE__ */ jsx(ProviderCard, { p: p2, now }, id);
      return loading ? /* @__PURE__ */ jsx(ProviderSkeleton, { id }, id) : null;
    }),
    hidden.length > 0 && enabled.length > 0 && /* @__PURE__ */ jsxs("p", { className: "ul-lim__hidden", children: [
      t("lim.hidden", { names: hidden.join(" / ") }),
      " ·",
      " ",
      /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", className: "ul-linkbtn", onClick: () => app.openSettings(), children: t("lim.gotoSettings") })
    ] }),
    !enabled.length && /* @__PURE__ */ jsxs("section", { className: "ul-card ul-empty", children: [
      /* @__PURE__ */ jsx("h3", { children: t("lim.noneTitle") }),
      /* @__PURE__ */ jsx("p", { children: t("lim.noneBody") }),
      /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "sm", onClick: () => app.openSettings(), children: t("lim.gotoSettings") })
    ] })
  ] });
}

// src/domain/summary.ts
function popoverSummary(input) {
  const ex = { excluded: input.excluded };
  const daily = filterRows(input.daily, ex);
  const todayHours = filterRows(input.todayHours, ex);
  const r7 = rollingRange(7, input.today);
  const r30 = rollingRange(30, input.today);
  const rows7 = filterRows(daily, r7);
  return {
    today: sumRows(filterRows(daily, { from: input.today, to: input.today })),
    delta: input.yesterdayHours ? todayVsYesterday(todayHours, filterRows(input.yesterdayHours, ex), input.now) : null,
    hours: hourlyTotals(todayHours),
    nowHour: input.now.getHours(),
    last7: sumRows(rows7),
    active7: activeDays(rows7),
    last30: sumRows(filterRows(daily, r30)),
    all: sumRows(daily)
  };
}
function compareKind(pr, mode) {
  if (pr.period === "day") return mode === "sameTime" ? "sameTime" : "prevDay";
  if (pr.period === "custom") return "custom";
  const base = pr.period;
  return mode === "toDate" ? `${base}ToDate` : base;
}
function heroSummary(input) {
  const { pr, today } = input;
  const end = elapsedEnd(pr, today);
  const base = filterRows(input.daily, { excluded: input.excluded });
  const inPeriod = filterRows(base, { from: pr.from, to: end });
  const rows = input.engine ? filterRows(inPeriod, { engine: input.engine }) : inPeriod;
  const engineRows = input.engine ? filterRows(base, { engine: input.engine }) : base;
  const sum = sumRows(rows);
  const span = Math.max(0, daysBetween(pr.from, end) + 1);
  let compare = null;
  const prev = previousRange(pr, today);
  if (prev) {
    let previous;
    if (prev.mode === "sameTime") {
      const hours = input.prevDayHours ? filterRows(input.prevDayHours, { excluded: input.excluded, engine: input.engine }) : null;
      previous = hours ? sameTimeTotal(hourlyTotals(hours), input.now.getHours(), input.now.getMinutes() / 60) : null;
    } else {
      previous = sumRows(filterRows(engineRows, { from: prev.from, to: prev.to })).total;
    }
    const d = previous == null ? null : delta(sum.total, previous);
    compare = d == null ? null : { delta: d, kind: compareKind(pr, prev.mode), span: prev.span };
  }
  const forecast = pr.gran === "day" && pr.containsToday ? forecastTotal({ periodTotal: sum.total, to: pr.to, today, avg: recentDailyAvg(engineRows, today) }) : null;
  const shares = engineShares(inPeriod);
  return {
    rows,
    sum,
    span,
    active: activeDays(rows),
    forecast,
    compare,
    shares,
    sharesTotal: shares.reduce((acc, s) => acc + s.total, 0),
    modelCount: new Set(inPeriod.map((r) => r.model)).size
  };
}
function lastDays(rows, today, n = 30) {
  const totals = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const day = r.bucket.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + tokensOf(r));
  }
  return Array.from({ length: n }, (_, i) => {
    const key = addDays(today, i - (n - 1));
    return { key, total: totals.get(key) ?? 0 };
  });
}

// src/domain/trend.ts
var OTHER_KEY = "__other";
var MAX_MODEL_SERIES = 6;
function seriesDefs(rows, by, otherLabel) {
  const totals = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const k = by === "engine" ? r.engine : r.model;
    totals.set(k, (totals.get(k) ?? 0) + tokensOf(r));
  }
  const present = [...totals.entries()].filter(([, v]) => v > 0);
  if (by === "engine") {
    return present.map(([id]) => id).sort(engineOrder).map((id) => ({ key: id, name: engineDef(id).label, color: engineDef(id).color }));
  }
  const ranked = present.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const colors = assignModelColors(present.map(([model]) => model));
  const top = ranked.slice(0, MAX_MODEL_SERIES).map(([model]) => ({ key: model, name: model, color: colors.get(model) ?? OTHER_COLOR }));
  return ranked.length > MAX_MODEL_SERIES ? [...top, { key: OTHER_KEY, name: otherLabel, color: OTHER_COLOR }] : top;
}
function splitParts(rows, defs, by) {
  const keys = new Set(defs.map((d) => d.key));
  const vals = new Map(defs.map((d) => [d.key, 0]));
  for (const r of rows) {
    const raw = by === "engine" ? r.engine : r.model;
    const key = keys.has(raw) ? raw : OTHER_KEY;
    if (vals.has(key)) vals.set(key, (vals.get(key) ?? 0) + tokensOf(r));
  }
  return defs.map((d) => ({ ...d, v: vals.get(d.key) ?? 0 }));
}
function indexByDay(rows) {
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const day = r.bucket.slice(0, 10);
    const list = map.get(day);
    if (list) list.push(r);
    else map.set(day, [r]);
  }
  return map;
}
function rowsIn(index, from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = index.get(d);
    if (list) out.push(...list);
  }
  return out;
}
function rawBuckets(pr, today, nowHour) {
  const out = [];
  if (pr.gran === "hour") {
    const isToday = pr.from === today;
    for (let h = 0; h < 24; h += 1) {
      out.push({ key: `h${h}`, from: pr.from, to: pr.from, hour: h, future: isToday && h > nowHour, isNow: isToday && h === nowHour, drill: null });
    }
    return out;
  }
  if (pr.gran === "day") {
    for (let d = pr.from; d <= pr.to; d = addDays(d, 1)) {
      out.push({ key: d, from: d, to: d, hour: null, future: d > today, isNow: d === today, drill: { kind: "day", key: d } });
    }
    return out;
  }
  if (pr.gran === "week") {
    for (let d = pr.from; d <= pr.to; d = addDays(d, 7)) {
      const end = minKey(addDays(d, 6), pr.to);
      out.push({ key: `w${d}`, from: d, to: end, hour: null, future: d > today, isNow: d <= today && today <= end, drill: { kind: "week", key: d } });
    }
    return out;
  }
  for (let m = startOfMonth(pr.from); m <= pr.to; m = addMonths(m, 1)) {
    const end = endOfMonth(m);
    out.push({
      key: `m${m}`,
      from: maxKey(m, pr.from),
      to: minKey(end, pr.to),
      hour: null,
      future: m > today,
      isNow: m <= today && today <= end,
      drill: { kind: "month", key: m }
    });
  }
  return out;
}
function trendBuckets(opts) {
  const { pr, today, nowHour, by } = opts;
  const source = pr.gran === "hour" ? opts.hourly : opts.daily;
  const defs = seriesDefs(source, by, opts.otherLabel);
  const byDay = pr.gran === "hour" ? null : indexByDay(opts.daily);
  const byHour = /* @__PURE__ */ new Map();
  if (pr.gran === "hour") {
    for (const r of opts.hourly) {
      const { hour } = parseBucket(r.bucket);
      if (hour == null) continue;
      byHour.set(hour, [...byHour.get(hour) ?? [], r]);
    }
  }
  const forecastOn = pr.gran === "day" && pr.containsToday && opts.avg > 0;
  return rawBuckets(pr, today, nowHour).map((b) => {
    const rows = b.future ? [] : b.hour != null ? byHour.get(b.hour) ?? [] : rowsIn(byDay, b.from, b.to);
    const sum = sumRows(rows);
    return {
      ...b,
      gran: pr.gran,
      total: sum.total,
      sum,
      parts: splitParts(rows, defs, by),
      forecast: forecastOn && b.future ? opts.avg : 0
    };
  });
}
function niceCeil(v) {
  if (!(v > 0)) return 1;
  const p2 = 10 ** Math.floor(Math.log10(v));
  const n = v / p2;
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((x) => n <= x + 1e-9) ?? 10;
  return step * p2;
}

// src/domain/workspaces.ts
var OTHER_PROJECT_ID = "__other";
var WIN_DRIVE = /^[a-z]:\//i;
function normalizePath(p2) {
  let s = p2.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.replace(/\/+$/, "");
  if (/^[a-z]:$/i.test(s)) s = `${s}/`;
  return WIN_DRIVE.test(s) ? s.toLowerCase() : s;
}
function isWithin(child, parent) {
  if (child === parent) return true;
  const base = parent.endsWith("/") ? parent : `${parent}/`;
  return child.startsWith(base);
}
function createProjectResolver(workspaces, otherName) {
  const other = { id: OTHER_PROJECT_ID, name: otherName, path: null };
  const entries = workspaces.filter((w) => typeof w.path === "string" && w.path.trim()).map((w) => ({ ref: { id: w.id, name: w.name || w.path, path: w.path }, norm: normalizePath(w.path) })).sort((a, b) => b.norm.length - a.norm.length);
  const cache = /* @__PURE__ */ new Map();
  return (cwd) => {
    if (!cwd) return other;
    const hit = cache.get(cwd);
    if (hit) return hit;
    const norm = normalizePath(cwd);
    const match = entries.find((e) => isWithin(norm, e.norm));
    const ref = match ? match.ref : other;
    cache.set(cwd, ref);
    return ref;
  };
}

// src/ui/page/overview/Trend.tsx
function bucketLabels(b, lang) {
  if (b.hour != null) return { short: String(b.hour), long: `${dateShort(b.from, lang)} ${hourRange(b.hour)}` };
  if (b.gran === "day") return { short: String(Number(b.from.slice(8))), long: dateWeek(b.from, lang) };
  if (b.gran === "week") return { short: `${Number(b.from.slice(5, 7))}/${Number(b.from.slice(8))}`, long: dateRange(b.from, b.to, lang) };
  return { short: monthShort(b.from, lang), long: monthLabel(b.from, lang) };
}
function moveFocus(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const cols = [...event.currentTarget.parentElement?.querySelectorAll(".ul-tcol:not(.is-static)") ?? []];
  const i = cols.indexOf(event.currentTarget);
  const next = cols[i + (event.key === "ArrowLeft" ? -1 : 1)];
  if (next) next.focus();
  event.preventDefault();
}
function Trend({
  pr,
  daily,
  hourly,
  hourlyReady
}) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const by = prefs.trendBy;
  const buckets = useMemo(
    () => trendBuckets({
      pr,
      today: usage.today,
      nowHour: (/* @__PURE__ */ new Date()).getHours(),
      daily,
      hourly,
      by,
      otherLabel: t("trend.other"),
      avg: recentDailyAvg(daily, usage.today)
    }),
    [pr, usage.today, daily, hourly, by, t]
  );
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.total, b.forecast)));
  const top = niceCeil(max);
  const every = buckets.length > 16 ? Math.ceil(buckets.length / 8) : 1;
  const legend = /* @__PURE__ */ new Map();
  for (const b of buckets) for (const p2 of b.parts) if (p2.v > 0) legend.set(p2.key, { name: p2.name, color: p2.color });
  const hasForecast = buckets.some((b) => b.forecast > 0);
  const tip = (b, long) => {
    if (b.forecast) {
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("b", { children: long }),
        /* @__PURE__ */ jsx("br", {}),
        t("trend.tipForecast", { v: tokens(b.forecast) }),
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("small", { children: t("trend.tipForecastNote") })
      ] });
    }
    if (b.future) return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("b", { children: long }),
      /* @__PURE__ */ jsx("br", {}),
      t("trend.tipFuture")
    ] });
    const parts = b.parts.filter((p2) => p2.v > 0).sort((x, y) => y.v - x.v);
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("b", { children: long }),
      /* @__PURE__ */ jsx("br", {}),
      tokens(b.total),
      " tokens · ",
      usd(b.sum.cost),
      parts.length > 0 && /* @__PURE__ */ jsx("ul", { className: "ul-tip__list", children: parts.map((p2) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("i", { style: { background: p2.color } }),
        /* @__PURE__ */ jsx("span", { className: "ul-tip__name", children: p2.name }),
        /* @__PURE__ */ jsx("b", { children: tokens(p2.v) })
      ] }, p2.key)) }),
      b.drill && /* @__PURE__ */ jsx("small", { children: t("trend.tipDrill") })
    ] });
  };
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-trend", children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-card__head", children: [
      /* @__PURE__ */ jsx("h3", { children: t("trend.title") }),
      /* @__PURE__ */ jsx(
        Segmented,
        {
          size: "xs",
          label: t("trend.by"),
          value: by,
          onChange: (v) => app.prefs.update((p2) => ({ ...p2, trendBy: v })),
          options: [
            { value: "engine", label: t("trend.byEngine") },
            { value: "model", label: t("trend.byModel") }
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "ul-legend", children: [
        [...legend.entries()].map(([key, l]) => /* @__PURE__ */ jsxs("span", { title: l.name, children: [
          /* @__PURE__ */ jsx("i", { style: { background: l.color } }),
          /* @__PURE__ */ jsx("span", { className: "ul-legend__name", children: l.name })
        ] }, key)),
        hasForecast && /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("i", { className: "ul-legend__fc" }),
          t("trend.forecast")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: cx("ul-tchart", !hourlyReady && "is-loading"), "aria-busy": !hourlyReady || void 0, children: [
      /* @__PURE__ */ jsx("div", { className: "ul-tgrid", "aria-hidden": "true", children: [1 / 3, 2 / 3, 1].map((f) => /* @__PURE__ */ jsx("span", { className: "ul-tgrid__line", style: { bottom: `${f * 100}%` }, children: /* @__PURE__ */ jsx("em", { children: tokens(top * f) }) }, f)) }),
      /* @__PURE__ */ jsx("div", { className: "ul-tcols", role: "group", "aria-label": t("trend.aria"), children: buckets.map((b, i) => {
        const { short, long } = bucketLabels(b, lang);
        const clickable = !!b.drill && !b.future;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: cx("ul-tcol", b.isNow && "is-now", b.future && "is-future", !clickable && "is-static"),
            tabIndex: clickable ? 0 : -1,
            "aria-disabled": !clickable || void 0,
            "aria-label": b.future ? t("trend.barFuture", { label: long }) : t("trend.barAria", { label: long, v: tokens(b.total) }),
            onClick: () => {
              const target = b.drill;
              if (clickable && target) app.view.set((s) => drill(s, target, usage.today));
            },
            onKeyDown: moveFocus,
            ...tipHandlers(() => tip(b, long)),
            children: [
              b.forecast > 0 && /* @__PURE__ */ jsx("span", { className: "ul-tcol__fc", style: { height: `${b.forecast / top * 100}%` } }),
              /* @__PURE__ */ jsx("span", { className: "ul-tcol__stack", style: { height: `${b.total / top * 100}%` }, children: b.parts.filter((p2) => p2.v > 0).map((p2) => /* @__PURE__ */ jsx("i", { style: { height: `${p2.v / b.total * 100}%`, background: p2.color } }, p2.key)) }),
              /* @__PURE__ */ jsx("span", { className: "ul-tcol__x", children: i % every === 0 ? short : "" })
            ]
          },
          b.key
        );
      }) })
    ] })
  ] });
}

// src/ui/page/overview/DetailTable.tsx
var COLS = {
  time: (gran) => [
    { key: "key", label: `col.${gran}` },
    { key: "total", label: "col.total", num: true },
    { key: "input", label: "col.input", num: true },
    { key: "output", label: "col.output", num: true },
    { key: "cacheRead", label: "col.cacheRead", num: true },
    { key: "cacheWrite", label: "col.cacheWrite", num: true },
    { key: "reasoning", label: "col.reasoning", num: true },
    { key: "requests", label: "col.requests", num: true },
    { key: "cost", label: "col.cost", num: true }
  ],
  project: () => [
    { key: "name", label: "col.name" },
    { key: "total", label: "col.total", num: true },
    { key: "share", label: "col.share" },
    { key: "requests", label: "col.requests", num: true },
    { key: "cost", label: "col.cost", num: true },
    { key: "last", label: "col.last" }
  ],
  model: () => [
    { key: "model", label: "col.model" },
    { key: "engine", label: "col.engine" },
    { key: "total", label: "col.total", num: true },
    { key: "input", label: "col.input", num: true },
    { key: "output", label: "col.output", num: true },
    { key: "cacheRead", label: "col.cacheRead", num: true },
    { key: "cost", label: "col.cost", num: true },
    { key: "priced", label: "col.priced" }
  ]
};
var costCell = (r) => Number(r.total) > 0 && Number(r.unknownTokens) >= Number(r.total) ? "—" : usd(Number(r.cost));
function DetailTable({
  pr,
  rows,
  daily,
  hourly
}) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const ref = useRef(null);
  const kind = view.table;
  const cols = COLS[kind](pr.gran);
  const sort = view.sort[kind];
  useEffect(() => {
    if (view.tableFocus > 0) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view.tableFocus]);
  const data = useMemo(() => {
    if (kind === "project") {
      const resolve = createProjectResolver(usage.workspaces, t("common.otherDir"));
      return projectRanking(rows, resolve).map((p2) => ({ ...p2 }));
    }
    if (kind === "model") return modelRanking(rows).map((m) => ({ ...m, id: m.model, engineLabel: engineDef(m.engine).label }));
    return trendBuckets({ pr, today: usage.today, nowHour: (/* @__PURE__ */ new Date()).getHours(), daily, hourly, by: "engine", otherLabel: "", avg: recentDailyAvg(daily, usage.today) }).filter((b) => !b.future && b.total > 0).map((b, i) => ({ ...b.sum, id: b.key, order: i, label: bucketLabels(b, lang).long, drillTo: b.drill }));
  }, [kind, rows, pr, usage.today, usage.workspaces, daily, hourly, lang, t]);
  const sorted = useMemo(() => sortRows(data, sort.key === "engine" ? { ...sort, key: "engineLabel" } : sort), [data, sort]);
  const cell = (r, c) => {
    switch (c.key) {
      case "key":
        return r.label;
      case "name":
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("b", { className: "ul-dt__name", children: r.name }),
          /* @__PURE__ */ jsx("code", { className: "ul-path", title: r.path ?? void 0, children: r.path ?? t("common.noWorkspace") })
        ] });
      case "model":
        return /* @__PURE__ */ jsx("b", { className: "ul-mono ul-dt__model", title: r.model, children: r.model });
      case "engine":
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(EngineDot, { color: engineDef(r.engine).color }),
          r.engineLabel
        ] });
      case "share":
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "ul-minibar", children: /* @__PURE__ */ jsx("i", { style: { width: `${Number(r.share) * 100}%` } }) }),
          share(Number(r.share))
        ] });
      case "requests":
        return int(Number(r.requests));
      case "cost":
        return costCell(r) === "—" ? /* @__PURE__ */ jsx("span", { className: "ul-muted", children: "—" }) : costCell(r);
      case "last":
        return r.last ? dateShort(r.last, lang) : "—";
      case "priced":
        return r.priced ? /* @__PURE__ */ jsx("span", { className: "ul-muted", children: t("col.pricedYes") }) : /* @__PURE__ */ jsx("span", { className: "ul-warn-text", children: t("col.pricedNo") });
      default:
        return tokens(Number(r[c.key]));
    }
  };
  const open = (r) => {
    if (kind === "time" && r.drillTo) {
      const target = r.drillTo;
      app.view.set((s) => drill(s, target, usage.today));
    } else if (kind === "project") app.view.set((s) => ({ ...s, drawer: r.id }));
  };
  const clickable = kind === "project" || kind === "time";
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-dtable", ref, children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-card__head", children: [
      /* @__PURE__ */ jsx(
        Segmented,
        {
          size: "xs",
          role: "tablist",
          label: t("table.aria"),
          value: kind,
          onChange: (k) => app.view.set((s) => setTable(s, k)),
          options: [
            { value: "time", label: t(`table.tab.${pr.gran}`) },
            { value: "project", label: t("table.tab.project") },
            { value: "model", label: t("table.tab.model") }
          ]
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "ul-card__meta", children: t("table.rows", { n: sorted.length }) })
    ] }),
    kind === "project" && usage.workspacesError && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-dt__alert", message: usage.workspacesError, onRetry: () => void app.usage.loadWorkspaces() }),
    /* @__PURE__ */ jsx("div", { className: "ul-dt-wrap", children: /* @__PURE__ */ jsxs("table", { className: "ul-dt", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: cols.map((c) => /* @__PURE__ */ jsx("th", { "aria-sort": ariaSort(sort, c.key), className: cx(c.num && "is-num"), children: /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => app.view.set((s) => sortBy(s, c.key)), children: [
        t(c.label),
        c.key === "reasoning" && /* @__PURE__ */ jsx(InfoTip, { text: t("col.reasoningInfo") }),
        /* @__PURE__ */ jsx("span", { className: "ul-sortc", "aria-hidden": "true", children: sort.key === c.key ? sort.dir === "asc" ? "↑" : "↓" : "" })
      ] }) }, c.key)) }) }),
      /* @__PURE__ */ jsx("tbody", { children: sorted.length ? sorted.map((r) => /* @__PURE__ */ jsx(
        "tr",
        {
          className: cx(clickable && "is-click"),
          tabIndex: clickable ? 0 : void 0,
          onClick: clickable ? () => open(r) : void 0,
          onKeyDown: clickable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(r)) : void 0,
          children: cols.map((c) => /* @__PURE__ */ jsx("td", { className: cx(c.num && "is-num"), children: cell(r, c) }, c.key))
        },
        r.id
      )) : /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: cols.length, className: "ul-dt__empty", children: t("table.empty") }) }) })
    ] }) })
  ] });
}

// src/domain/heatmap.ts
var HEATMAP_WEEKS = 26;
function quantileCuts(values, qs = [0.25, 0.5, 0.75]) {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return qs.map(() => 0);
  return qs.map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
}
function levelOf(total, cuts) {
  if (!(total > 0)) return 0;
  return Math.min(4, 1 + cuts.filter((c) => total > c).length);
}
function heatCells(dailyRows, today, weeks = HEATMAP_WEEKS) {
  const end = addDays(startOfWeek(today), 6);
  const start = addDays(end, -(weeks * 7) + 1);
  const totals = dailyTotals(dailyRows);
  const costs = /* @__PURE__ */ new Map();
  for (const r of dailyRows) if (r.cost != null) costs.set(r.bucket, (costs.get(r.bucket) ?? 0) + r.cost);
  const raw = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const future = d > today;
    raw.push({ key: d, total: future ? 0 : totals.get(d) ?? 0, cost: future ? 0 : costs.get(d) ?? 0, future });
  }
  const cuts = quantileCuts(raw.map((c) => c.total));
  return raw.map((c) => ({ ...c, level: levelOf(c.total, cuts) }));
}

// src/ui/page/overview/Heatmap.tsx
function Heatmap({ pr, engineDaily }) {
  const app = useApp();
  const { t, raw, lang } = app;
  const { usage } = useAll(app);
  const cells = useMemo(() => heatCells(engineDaily, usage.today), [engineDaily, usage.today]);
  const days = raw("heat.days").split(",");
  const months = Array.from({ length: HEATMAP_WEEKS }, (_, w) => {
    const first = cells[w * 7].key;
    const prev = w ? cells[(w - 1) * 7].key : null;
    return !prev || prev.slice(0, 7) !== first.slice(0, 7) ? monthShort(first, lang) : "";
  });
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-heat", children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-card__head", children: [
      /* @__PURE__ */ jsx("h3", { children: t("heat.title") }),
      /* @__PURE__ */ jsx("span", { className: "ul-card__meta", children: t("heat.meta") })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ul-heat__wrap", children: [
      /* @__PURE__ */ jsx("div", { className: "ul-heat__days", "aria-hidden": "true", children: days.map((d, i) => /* @__PURE__ */ jsx("span", { children: d }, i)) }),
      /* @__PURE__ */ jsxs("div", { className: "ul-heat__main", children: [
        /* @__PURE__ */ jsx("div", { className: "ul-heat__months", "aria-hidden": "true", children: months.map((m, i) => /* @__PURE__ */ jsx("span", { style: { gridColumn: i + 1 }, children: m }, i)) }),
        /* @__PURE__ */ jsx("div", { className: "ul-heat__grid", children: cells.map((c) => {
          if (c.future) return /* @__PURE__ */ jsx("i", { className: "ul-hm is-future", "aria-hidden": "true" }, c.key);
          if (usage.firstDay && c.key < usage.firstDay) return /* @__PURE__ */ jsx("i", { className: "ul-hm is-before", "aria-hidden": "true" }, c.key);
          const label = `${dateWeek(c.key, lang)}：${c.total ? `${tokens(c.total)} tokens` : t("heat.none")}`;
          return /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cx("ul-hm", `l${c.level}`, (c.key < pr.from || c.key > pr.to) && "is-out", c.key === usage.today && "is-today"),
              "aria-label": label,
              onClick: () => app.view.set((s) => drill(s, { kind: "day", key: c.key }, usage.today)),
              ...tipHandlers(() => /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("b", { children: dateWeek(c.key, lang) }),
                /* @__PURE__ */ jsx("br", {}),
                c.total ? `${tokens(c.total)} tokens · ${usd(c.cost)}` : t("heat.none")
              ] }))
            },
            c.key
          );
        }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ul-heat__legend", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx("span", { children: t("heat.less") }),
      [0, 1, 2, 3, 4].map((l) => /* @__PURE__ */ jsx("i", { className: `ul-hm l${l}` }, l)),
      /* @__PURE__ */ jsx("span", { children: t("heat.more") }),
      /* @__PURE__ */ jsx("span", { className: "ul-heat__note", children: t("heat.note") })
    ] })
  ] });
}

// src/ui/page/overview/Hero.tsx
var CMP_KEY = {
  sameTime: "cmp.sameTime",
  prevDay: "cmp.prevDay",
  week: "cmp.week",
  weekToDate: "cmp.weekToDate",
  month: "cmp.month",
  monthToDate: "cmp.monthToDate",
  year: "cmp.year",
  yearToDate: "cmp.yearToDate",
  custom: "cmp.custom"
};
function Hero({ pr, hero }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const { sum } = hero;
  const end = elapsedEnd(pr, usage.today);
  const scope = pr.period === "custom" ? t("hero.scopeCustom") : t("hero.scopePeriod", { unit: t(`unit.${pr.period === "all" ? "year" : pr.period}`) });
  const pick = (id) => app.view.set((s) => toggleEngine(s, id));
  const unpriced = [...sum.unknownModels].sort();
  const unpricedKey = unpriced.join(",");
  const showUnpriced = unpriced.length > 0 && unpricedKey !== prefs.ackUnpriced;
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-hero", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-hero__top", children: [
      /* @__PURE__ */ jsxs("div", { className: "ul-hero__main", children: [
        /* @__PURE__ */ jsxs("p", { className: "ul-kicker", children: [
          t("hero.kicker"),
          view.engine ? ` · ${engineDef(view.engine).label}` : ""
        ] }),
        /* @__PURE__ */ jsx("p", { className: "ul-hero__num", children: tokens(sum.total) }),
        /* @__PURE__ */ jsxs("p", { className: "ul-hero__sub", children: [
          t("hero.sub", {
            range: pr.from >= end ? dateShort(pr.from, lang) : dateRange(pr.from, end, lang),
            span: hero.span,
            active: hero.active
          }),
          hero.forecast != null && ` · ${t("hero.forecast", { scope, v: tokens(hero.forecast) })}`
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "ul-hero__cost", children: [
        /* @__PURE__ */ jsxs("p", { className: "ul-kicker", children: [
          t("hero.cost"),
          /* @__PURE__ */ jsx(InfoTip, { text: t("hero.costInfo") })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "ul-hero__money", children: usd(sum.cost) }),
        hero.compare && /* @__PURE__ */ jsxs("p", { className: "ul-delta ul-hero__delta", children: [
          hero.compare.delta >= 0 ? "↑" : "↓",
          " ",
          Math.abs(Math.round(hero.compare.delta * 100)),
          "%",
          /* @__PURE__ */ jsx("span", { children: t(CMP_KEY[hero.compare.kind], { n: hero.compare.span }) })
        ] })
      ] })
    ] }),
    showUnpriced && /* @__PURE__ */ jsxs("div", { className: "ul-warn-row", children: [
      /* @__PURE__ */ jsx(Icon, { name: "alert", size: 14 }),
      /* @__PURE__ */ jsx("span", { children: t("hero.unknown", { n: unpriced.length, models: unpriced.join("、"), tokens: tokens(sum.unknownTokens) }) }),
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          size: "sm",
          className: "ul-icon-btn ul-warn-row__x",
          "aria-label": t("hero.dismiss"),
          title: t("hero.dismiss"),
          onClick: () => app.prefs.update((p2) => ({ ...p2, ackUnpriced: unpricedKey })),
          children: /* @__PURE__ */ jsx(Icon, { name: "x", size: 14 })
        }
      )
    ] }),
    hero.shares.length > 0 && /* @__PURE__ */ jsx("div", { className: "ul-sharebar", role: "img", "aria-label": t("hero.shares"), children: hero.shares.map((x) => /* @__PURE__ */ jsx(
      "i",
      {
        className: cx(view.engine && view.engine !== x.id && "is-dim"),
        style: { width: `${x.share * 100}%`, background: engineDef(x.id).color },
        ...tipHandlers(() => /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("b", { children: engineDef(x.id).label }),
          /* @__PURE__ */ jsx("br", {}),
          tokens(x.total),
          " tokens · ",
          share(x.share)
        ] }))
      },
      x.id
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "ul-ecards", children: [
      /* @__PURE__ */ jsxs("button", { type: "button", className: cx("ul-ecard", !view.engine && "is-on"), "aria-pressed": !view.engine, onClick: () => pick(null), children: [
        /* @__PURE__ */ jsx("span", { className: "ul-ecard__name", children: t("engine.all") }),
        /* @__PURE__ */ jsx("b", { children: "100%" }),
        /* @__PURE__ */ jsx("span", { className: "ul-ecard__sub", children: t("engine.sub", { n: hero.modelCount, tokens: tokens(hero.sharesTotal) }) })
      ] }),
      hero.shares.map((x) => {
        const on = view.engine === x.id;
        const def = engineDef(x.id);
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: cx("ul-ecard", on && "is-on", view.engine && !on && "is-dim"),
            "aria-pressed": on,
            onClick: () => pick(x.id),
            children: [
              /* @__PURE__ */ jsxs("span", { className: "ul-ecard__name", children: [
                /* @__PURE__ */ jsx(EngineDot, { color: def.color }),
                def.label
              ] }),
              /* @__PURE__ */ jsx("b", { children: share(x.share) }),
              /* @__PURE__ */ jsx("span", { className: "ul-ecard__sub", children: t("engine.sub", { n: x.models, tokens: tokens(x.total) }) })
            ]
          },
          x.id
        );
      })
    ] })
  ] });
}

// src/ui/page/overview/RangePicker.tsx
var PRESETS = [
  { id: "7", key: "range.p7" },
  { id: "30", key: "range.p30" },
  { id: "90", key: "range.p90" },
  { id: "ytd", key: "range.ytd" }
];
function RangePicker({ anchorRef }) {
  const app = useApp();
  const { t, raw, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const today = usage.today;
  const base = view.range ?? rollingRange(30, today);
  const [draft, setDraft] = useState(base);
  const [month, setMonth] = useState(startOfMonth(base.to));
  const layerRef = useRef(null);
  const close = () => app.view.set((s) => s.layer === "range" ? { ...s, layer: null } : s);
  useDismiss([layerRef, anchorRef], true, close);
  useEscape(true, close);
  const check = validateCustomRange(draft, today);
  const weekdays = raw("range.weekdays").split(",");
  const canNext = addMonths(month, 1) <= today;
  const inDraft = (k) => !!draft.from && !!draft.to && k >= draft.from && k <= draft.to;
  const summary = !draft.to ? /* @__PURE__ */ jsx("span", { className: "ul-muted", children: t("range.pickEnd") }) : !check.ok && check.reason === "tooLong" ? /* @__PURE__ */ jsx("span", { className: "ul-error-text", children: t("range.tooLong", { n: check.days }) }) : !check.ok && check.reason === "future" ? /* @__PURE__ */ jsx("span", { className: "ul-error-text", children: t("range.future") }) : /* @__PURE__ */ jsx("span", { children: t("range.summary", { from: dateShort(draft.from, lang), to: dateShort(draft.to, lang), n: check.days }) });
  const renderMonth = (m) => {
    const grid = monthGrid(m);
    return /* @__PURE__ */ jsxs("div", { className: "ul-cal__m", children: [
      /* @__PURE__ */ jsx("p", { children: monthLabel(m, lang) }),
      /* @__PURE__ */ jsxs("div", { className: "ul-cal__g", role: "grid", "aria-label": monthLabel(m, lang), children: [
        weekdays.map((d) => /* @__PURE__ */ jsx("span", { className: "ul-cal__wd", children: d }, d)),
        Array.from({ length: grid.lead }, (_, i) => /* @__PURE__ */ jsx("span", {}, `b${i}`)),
        grid.days.map((k) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: cx("ul-cal__d", inDraft(k) && "is-in", k === draft.from && "is-start", k === draft.to && "is-end", k === today && "is-today"),
            disabled: k > today,
            "aria-pressed": k === draft.from || k === draft.to,
            "aria-label": dateShort(k, lang),
            onClick: () => setDraft((d) => pickDraftDay(d, k)),
            children: Number(k.slice(8))
          },
          k
        ))
      ] })
    ] }, m);
  };
  return /* @__PURE__ */ jsxs("div", { ref: layerRef, className: "ul-layer ul-layer--range", role: "dialog", "aria-label": t("range.aria"), children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-range", children: [
      /* @__PURE__ */ jsx("div", { className: "ul-range__presets", children: PRESETS.map((p2) => /* @__PURE__ */ jsx("button", { type: "button", className: "ul-range__p", onClick: () => app.view.set((s) => applyRange(s, presetRange(p2.id, today))), children: t(p2.key) }, p2.id)) }),
      /* @__PURE__ */ jsxs("div", { className: "ul-range__cal", children: [
        /* @__PURE__ */ jsxs("div", { className: "ul-range__nav", children: [
          /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", className: "ul-icon-btn", "aria-label": t("range.prevMonth"), title: t("range.prevMonth"), onClick: () => setMonth((m) => addMonths(m, -1)), children: /* @__PURE__ */ jsx(Icon, { name: "chevL", size: 14 }) }),
          /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", className: "ul-icon-btn", "aria-label": t("range.nextMonth"), title: t("range.nextMonth"), disabled: !canNext, onClick: () => setMonth((m) => addMonths(m, 1)), children: /* @__PURE__ */ jsx(Icon, { name: "chevR", size: 14 }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "ul-cal", children: [addMonths(month, -1), month].map(renderMonth) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("footer", { className: "ul-layer__foot ul-layer__foot--split", children: [
      summary,
      /* @__PURE__ */ jsxs("span", { className: "ul-layer__btns", children: [
        /* @__PURE__ */ jsx(Button, { variant: "ghost", size: "sm", onClick: close, children: t("common.cancel") }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "primary",
            size: "sm",
            disabled: !check.ok,
            onClick: () => {
              if (check.ok && draft.from && draft.to) {
                const range = { from: draft.from, to: draft.to };
                app.view.set((s) => applyRange(s, range));
              }
            },
            children: t("common.apply")
          }
        )
      ] })
    ] })
  ] });
}

// src/ui/page/overview/PeriodBar.tsx
var PERIODS = ["day", "week", "month", "year", "all", "custom"];
function periodLabel(pr, today, firstDay, t, lang) {
  switch (pr.period) {
    case "day":
      return `${dateWeek(pr.from, lang)}${pr.from === today ? t("nav.todaySuffix") : ""}`;
    case "week":
    case "custom":
      return dateRange(pr.from, pr.to, lang);
    case "month":
      return monthLabel(pr.from, lang);
    case "year":
      return yearLabel(pr.from, lang);
    default:
      return t("nav.allLabel", { date: firstDay ? dateShort(firstDay, lang) : dateShort(today, lang) });
  }
}
function PeriodBar({ pr }) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const tabsRef = useRef(null);
  const today = usage.today;
  const unit = pr.period === "day" || pr.period === "week" || pr.period === "month" || pr.period === "year" ? pr.period : null;
  const choose = (p2) => {
    if (p2 === "custom") app.view.set((s) => toggleLayer(s, "range"));
    else app.view.set((s) => setPeriod(s, p2, today));
  };
  return /* @__PURE__ */ jsxs("div", { className: "ul-pbar", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-pbar__tabs", ref: tabsRef, children: [
      /* @__PURE__ */ jsx(
        Segmented,
        {
          role: "tablist",
          label: t("period.aria"),
          value: view.period,
          onChange: choose,
          options: PERIODS.map((p2) => ({
            value: p2,
            label: t(`period.${p2}`),
            icon: p2 === "custom" ? "cal" : void 0
          }))
        }
      ),
      view.layer === "range" && /* @__PURE__ */ jsx(RangePicker, { anchorRef: tabsRef })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "ul-pnav", children: unit ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          size: "sm",
          className: "ul-icon-btn",
          "aria-label": t("nav.prev", { unit: t(`unit.${unit}`) }),
          title: t("nav.prev", { unit: t(`unit.${unit}`) }),
          disabled: !canShift(pr.period, view.anchor, -1, today, usage.firstDay),
          onClick: () => app.view.set((s) => shift(s, -1)),
          children: /* @__PURE__ */ jsx(Icon, { name: "chevL", size: 14 })
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "ul-pnav__lbl", children: periodLabel(pr, today, usage.firstDay, t, lang) }),
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          size: "sm",
          className: "ul-icon-btn",
          "aria-label": t("nav.next", { unit: t(`unit.${unit}`) }),
          title: t("nav.next", { unit: t(`unit.${unit}`) }),
          disabled: !canShift(pr.period, view.anchor, 1, today, usage.firstDay),
          onClick: () => app.view.set((s) => shift(s, 1)),
          children: /* @__PURE__ */ jsx(Icon, { name: "chevR", size: 14 })
        }
      ),
      !pr.containsToday && /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "sm", onClick: () => app.view.set((s) => goToday(s, today)), children: t(`nav.back.${unit}`) })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("span", { className: "ul-pnav__lbl", children: periodLabel(pr, today, usage.firstDay, t, lang) }),
      pr.period === "custom" && /* @__PURE__ */ jsx("span", { className: "ul-pnav__muted", children: t("nav.days", { n: daysBetween(pr.from, pr.to) + 1 }) })
    ] }) }),
    view.engine && /* @__PURE__ */ jsxs("span", { className: "ul-fchip", children: [
      /* @__PURE__ */ jsx(EngineDot, { color: engineDef(view.engine).color }),
      t("filter.only", { name: engineDef(view.engine).label }),
      /* @__PURE__ */ jsx("button", { type: "button", "aria-label": t("filter.clear"), title: t("filter.clear"), onClick: () => app.view.set((s) => toggleEngine(s, null)), children: /* @__PURE__ */ jsx(Icon, { name: "x", size: 12 }) })
    ] })
  ] });
}

// src/ui/BrandMark.tsx
var EYES = [
  "M219.9 219.4A51.2 51.2 0 1 0 219.9 287.4A34 34 0 1 1 219.9 219.4Z",
  "M370.4 219.5A51.2 51.2 0 1 0 370.4 287.5A34 34 0 1 1 370.4 219.5Z"
];
function BrandMark({ size, running = false, still = false }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: cx("ul-brand", running && !still && "is-running", still && "is-still"),
      style: { height: size, width: size },
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("svg", { viewBox: "46 46 420 420", children: /* @__PURE__ */ jsx("g", { className: "ul-brand__eyes", children: EYES.map((d) => /* @__PURE__ */ jsx("path", { d }, d)) }) })
    }
  );
}

// src/ui/page/overview/ScanStates.tsx
function LoadingState() {
  return /* @__PURE__ */ jsx("div", { className: "ul-ov", "aria-busy": "true", children: /* @__PURE__ */ jsxs("div", { className: "ul-skel-grid", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--bar" }),
    /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--hero" }),
    /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--card" }),
    /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--card" })
  ] }) });
}
function ErrorState() {
  const app = useApp();
  const { usage } = useAll(app);
  return /* @__PURE__ */ jsx("div", { className: "ul-ov", children: /* @__PURE__ */ jsxs("section", { className: "ul-card ul-empty", children: [
    /* @__PURE__ */ jsx("h3", { children: app.t("error.title") }),
    /* @__PURE__ */ jsx(InlineAlert, { message: usage.error ?? "", onRetry: () => void app.usage.reload() })
  ] }) });
}
function ScanState() {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  const pct2 = scanPct(usage);
  const current = usage.progress?.engine ?? null;
  const seen = usage.progressEngines;
  useEffect(() => {
    if (usage.sources.phase === "idle") void app.usage.loadSources();
  }, [app, usage.sources.phase]);
  const ids = usage.sources.data?.filter((s) => s.status === "ok").map((s) => s.engine) ?? ENGINES.map((e) => e.id);
  return /* @__PURE__ */ jsxs("div", { className: "ul-ov", children: [
    /* @__PURE__ */ jsxs("section", { className: "ul-card ul-scan", role: "status", children: [
      /* @__PURE__ */ jsxs("div", { className: "ul-scan__head", children: [
        /* @__PURE__ */ jsx(Spinner, { size: 16 }),
        /* @__PURE__ */ jsx("b", { children: t("scan.title") }),
        /* @__PURE__ */ jsxs("span", { className: "ul-scan__pct", children: [
          pct2,
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "ul-progress", "aria-hidden": "true", children: /* @__PURE__ */ jsx("i", { style: { width: `${pct2}%` } }) }),
      /* @__PURE__ */ jsx("p", { children: t("scan.body", { done: int(usage.progress?.done ?? 0), total: int(usage.progress?.total ?? 0) }) }),
      /* @__PURE__ */ jsx("ul", { className: "ul-scan__list", children: ids.map((id) => {
        const state = id === current ? "run" : seen.includes(id) ? "done" : "wait";
        const src = usage.sources.data?.find((s) => s.engine === id);
        return /* @__PURE__ */ jsxs("li", { className: cx(`is-${state}`), children: [
          state === "done" ? /* @__PURE__ */ jsx(Icon, { name: "check", size: 14 }) : state === "run" ? /* @__PURE__ */ jsx(Spinner, {}) : /* @__PURE__ */ jsx("i", { "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("b", { children: src?.label ?? engineDef(id).label }),
          /* @__PURE__ */ jsx("span", { children: state === "wait" ? t("scan.waiting") : state === "run" ? t("scan.running") : src ? t("scan.files", { n: int(src.files) }) : t("scan.done") })
        ] }, id);
      }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ul-skel-grid", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--hero" }),
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--card" }),
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--card" })
    ] })
  ] });
}
function EmptyState() {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  useEffect(() => {
    if (usage.sources.phase === "idle") void app.usage.loadSources();
  }, [app, usage.sources.phase]);
  const dirs = usage.sources.data ? usage.sources.data.flatMap((s) => s.roots.map((root) => ({ key: `${s.engine}:${root}`, name: s.label, dir: root }))) : ENGINES.map((e) => ({ key: e.id, name: e.label, dir: e.dir }));
  return /* @__PURE__ */ jsx("div", { className: "ul-ov", children: /* @__PURE__ */ jsxs("section", { className: "ul-card ul-empty", children: [
    /* @__PURE__ */ jsx(BrandMark, { size: 44, still: true }),
    /* @__PURE__ */ jsx("h3", { children: t("empty.title") }),
    /* @__PURE__ */ jsx("p", { children: t("pop.emptyBody") }),
    usage.sources.phase === "error" && /* @__PURE__ */ jsx(InlineAlert, { message: t("src.loadError", { error: usage.sources.error ?? "" }), onRetry: () => void app.usage.loadSources() }),
    /* @__PURE__ */ jsxs("details", { className: "ul-empty__dirs", children: [
      /* @__PURE__ */ jsx("summary", { children: t("empty.dirs", { n: dirs.length }) }),
      /* @__PURE__ */ jsx("ul", { children: dirs.map((d) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("b", { children: d.name }),
        /* @__PURE__ */ jsx("code", { children: d.dir })
      ] }, d.key)) })
    ] })
  ] }) });
}

// src/ui/page/overview/SideCards.tsx
function StatsCard({ hero, engineDaily }) {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  const totalActive = useMemo(() => activeDays(engineDaily), [engineDaily]);
  const tile = (label, value, sub) => /* @__PURE__ */ jsxs("div", { className: "ul-stile", children: [
    /* @__PURE__ */ jsx("b", { children: value }),
    /* @__PURE__ */ jsx("span", { children: label }),
    sub && /* @__PURE__ */ jsx("small", { children: sub })
  ] });
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-stats", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-stiles", children: [
      tile(t("stats.avg"), tokens(hero.active ? hero.sum.total / hero.active : 0), t("stats.avgNote")),
      tile(
        t("stats.activeDays"),
        /* @__PURE__ */ jsxs(Fragment, { children: [
          hero.active,
          /* @__PURE__ */ jsxs("em", { children: [
            "/ ",
            hero.span
          ] })
        ] })
      ),
      tile(t("stats.requests"), int(hero.sum.requests), t("stats.requestsNote")),
      tile(t("stats.sessions"), int(hero.sum.sessions))
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "ul-stats__foot", children: [
      /* @__PURE__ */ jsx("span", { children: usage.firstDay ? t("stats.first", { date: usage.firstDay }) : "" }),
      /* @__PURE__ */ jsx("span", { children: t("stats.total", { n: totalActive }) })
    ] })
  ] });
}
function ModelItem({ m, rank, color }) {
  return /* @__PURE__ */ jsxs("li", { children: [
    /* @__PURE__ */ jsx("span", { className: "ul-rank", children: rank }),
    /* @__PURE__ */ jsxs("span", { className: "ul-mname", title: m.model, children: [
      /* @__PURE__ */ jsx(EngineDot, { color }),
      /* @__PURE__ */ jsx("span", { className: "ul-mono", children: m.model })
    ] }),
    /* @__PURE__ */ jsx("b", { children: share(m.share) }),
    /* @__PURE__ */ jsx("span", { className: "ul-mbar", children: /* @__PURE__ */ jsx("i", { style: { width: `${m.share * 100}%`, background: color } }) })
  ] });
}
function ModelRanking({ rows }) {
  const app = useApp();
  const { t } = app;
  const view = useStore(app.view);
  const list = useMemo(() => modelRanking(rows), [rows]);
  const colors = useMemo(() => assignModelColors(list.map((m) => m.model)), [list]);
  const top = list.slice(0, 5);
  const rest = list.slice(5);
  const open = view.modelsOpen;
  const item = (m, rank) => /* @__PURE__ */ jsx(ModelItem, { m, rank, color: colors.get(m.model) ?? OTHER_COLOR }, m.model);
  return /* @__PURE__ */ jsxs("section", { className: "ul-card ul-models", children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-card__head", children: [
      /* @__PURE__ */ jsx("h3", { children: t("models.title") }),
      /* @__PURE__ */ jsx("span", { className: "ul-card__meta", children: t("models.meta") })
    ] }),
    list.length ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("ol", { className: "ul-mlist", children: top.map((m, i) => item(m, i + 1)) }),
      rest.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Collapse, { open, id: "ul-models-more", children: /* @__PURE__ */ jsx("ol", { className: "ul-mlist ul-mlist--more", start: 6, children: rest.map((m, i) => item(m, i + 6)) }) }),
        /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "ul-linkbtn ul-models__more",
            "aria-expanded": open,
            "aria-controls": "ul-models-more",
            onClick: () => app.view.set((s) => ({ ...s, modelsOpen: !s.modelsOpen })),
            children: [
              open ? t("models.less") : t("models.more", { n: list.length }),
              /* @__PURE__ */ jsx(Icon, { name: "chevD", size: 13, className: open ? "ul-flip" : void 0 })
            ]
          }
        )
      ] })
    ] }) : /* @__PURE__ */ jsx("p", { className: "ul-card__empty", children: t("common.noData") })
  ] });
}

// src/ui/page/overview/Overview.tsx
function Overview() {
  const app = useApp();
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const pr = useMemo(
    () => periodRange(view.period, view.anchor, view.range, usage.today, usage.firstDay),
    [view.period, view.anchor, view.range, usage.today, usage.firstDay]
  );
  useEffect(() => {
    if (pr.gran !== "hour") return;
    app.usage.ensureHours(pr.from);
    app.usage.ensureHours(addDays(pr.from, -1));
  }, [app, pr.gran, pr.from]);
  const hero = useMemo(
    () => heroSummary({
      pr,
      daily: usage.daily,
      prevDayHours: usage.hourly[addDays(pr.from, -1)] ?? null,
      today: usage.today,
      now: /* @__PURE__ */ new Date(),
      engine: view.engine,
      excluded: prefs.excludedEngines
    }),
    [pr, usage.daily, usage.hourly, usage.today, view.engine, prefs.excludedEngines]
  );
  const engineDaily = useMemo(
    () => filterRows(usage.daily, { excluded: prefs.excludedEngines, engine: view.engine }),
    [usage.daily, prefs.excludedEngines, view.engine]
  );
  const hourly = useMemo(
    () => filterRows(usage.hourly[pr.from] ?? [], { excluded: prefs.excludedEngines, engine: view.engine }),
    [usage.hourly, pr.from, prefs.excludedEngines, view.engine]
  );
  if (usage.phase === "loading" && !usage.daily.length) return /* @__PURE__ */ jsx(LoadingState, {});
  if (usage.phase === "error" && !usage.daily.length) return /* @__PURE__ */ jsx(ErrorState, {});
  if (usage.scanning && !usage.firstDay) return /* @__PURE__ */ jsx(ScanState, {});
  if (isEmpty(usage)) return /* @__PURE__ */ jsx(EmptyState, {});
  return /* @__PURE__ */ jsxs("div", { className: "ul-ov", children: [
    /* @__PURE__ */ jsx(PeriodBar, { pr }),
    /* @__PURE__ */ jsx(Hero, { pr, hero }),
    /* @__PURE__ */ jsxs("div", { className: "ul-ov__grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "ul-ov__main", children: [
        /* @__PURE__ */ jsx(Trend, { pr, daily: engineDaily, hourly, hourlyReady: pr.gran !== "hour" || !!usage.hourly[pr.from] }),
        /* @__PURE__ */ jsx(DetailTable, { pr, rows: hero.rows, daily: engineDaily, hourly })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "ul-ov__side", children: [
        /* @__PURE__ */ jsx(StatsCard, { hero, engineDaily }),
        /* @__PURE__ */ jsx(ModelRanking, { rows: hero.rows }),
        /* @__PURE__ */ jsx(Heatmap, { pr, engineDaily })
      ] })
    ] })
  ] });
}

// src/ui/page/overview/ProjectDrawer.tsx
function ProjectDrawer({ projectId }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const closeRef = useRef(null);
  const close = () => app.view.set((s) => ({ ...s, drawer: null }));
  useEscape(true, close);
  useEffect(() => closeRef.current?.focus(), []);
  const data = useMemo(() => {
    const resolve = createProjectResolver(usage.workspaces, t("common.otherDir"));
    const pr = periodRange(view.period, view.anchor, view.range, usage.today, usage.firstDay);
    const mine = filterRows(usage.daily, { excluded: prefs.excludedEngines, engine: view.engine }).filter((r) => resolve(r.project).id === projectId);
    const inPeriod = filterRows(mine, { from: pr.from, to: elapsedEnd(pr, usage.today) });
    const ref = resolve(mine[0]?.project ?? null);
    return {
      pr,
      ref: mine.length ? ref : { id: projectId, name: projectId, path: null },
      sum: sumRows(inPeriod),
      engines: engineShares(inPeriod),
      models: modelRanking(inPeriod),
      days: lastDays(mine, usage.today)
    };
  }, [usage.workspaces, usage.daily, usage.today, usage.firstDay, view, prefs.excludedEngines, projectId, t]);
  const dmax = Math.max(1, ...data.days.map((d) => d.total));
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "ul-scrim", onClick: close, "aria-hidden": "true" }),
    /* @__PURE__ */ jsxs("aside", { className: "ul-drawer", role: "dialog", "aria-modal": "false", "aria-label": t("drawer.aria", { name: data.ref.name }), children: [
      /* @__PURE__ */ jsxs("header", { className: "ul-drawer__head", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { children: data.ref.name }),
          /* @__PURE__ */ jsx("code", { className: "ul-path", title: data.ref.path ?? void 0, children: data.ref.path ?? t("common.noWorkspace") })
        ] }),
        /* @__PURE__ */ jsx(Button, { ref: closeRef, variant: "ghost", className: "ul-icon-btn", "aria-label": t("common.close"), title: t("common.close"), onClick: close, children: /* @__PURE__ */ jsx(Icon, { name: "x" }) })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "ul-kicker", children: [
        periodLabel(data.pr, usage.today, usage.firstDay, t, lang),
        view.engine ? ` · ${engineDef(view.engine).label}` : ""
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "ul-drawer__nums", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: t("drawer.total") }),
          /* @__PURE__ */ jsx("b", { children: tokens(data.sum.total) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: t("drawer.cost") }),
          /* @__PURE__ */ jsx("b", { children: usd(data.sum.cost) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: t("drawer.requests") }),
          /* @__PURE__ */ jsx("b", { children: int(data.sum.requests) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "ul-kicker", children: t("drawer.byEngine") }),
      /* @__PURE__ */ jsx("div", { className: "ul-sharebar ul-sharebar--sm", "aria-hidden": "true", children: data.engines.map((e) => /* @__PURE__ */ jsx("i", { style: { width: `${e.share * 100}%`, background: engineDef(e.id).color } }, e.id)) }),
      /* @__PURE__ */ jsx("ul", { className: "ul-kv", children: data.engines.map((e) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx(EngineDot, { color: engineDef(e.id).color }),
        engineDef(e.id).label,
        /* @__PURE__ */ jsx("b", { children: tokens(e.total) })
      ] }, e.id)) }),
      /* @__PURE__ */ jsx("p", { className: "ul-kicker", children: t("drawer.byModel") }),
      /* @__PURE__ */ jsx("ul", { className: "ul-kv", children: data.models.length ? data.models.map((m) => /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("span", { className: "ul-mono ul-kv__name", title: m.model, children: m.model }),
        /* @__PURE__ */ jsx("b", { children: tokens(m.total) })
      ] }, m.model)) : /* @__PURE__ */ jsx("li", { className: "ul-muted", children: t("common.noData") }) }),
      /* @__PURE__ */ jsx("p", { className: "ul-kicker", children: t("drawer.last30") }),
      /* @__PURE__ */ jsx("div", { className: "ul-mini", children: data.days.map((d) => /* @__PURE__ */ jsx(
        "i",
        {
          tabIndex: 0,
          "aria-label": `${dateWeek(d.key, lang)} ${tokens(d.total)} tokens`,
          style: { height: `${Math.max(2, d.total / dmax * 100)}%` },
          ...tipHandlers(() => /* @__PURE__ */ jsxs(Fragment, { children: [
            dateWeek(d.key, lang),
            /* @__PURE__ */ jsx("br", {}),
            tokens(d.total),
            " tokens"
          ] }))
        },
        d.key
      )) })
    ] })
  ] });
}

// src/ui/Rescan.tsx
function RescanControl({ hint }) {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  if (usage.rescan.running) {
    const pct2 = scanPct(usage);
    return /* @__PURE__ */ jsxs("div", { className: "ul-progress-line", role: "status", children: [
      /* @__PURE__ */ jsx(Spinner, {}),
      /* @__PURE__ */ jsx("span", { children: t("src.rescanning", { pct: pct2 }) }),
      /* @__PURE__ */ jsx("span", { className: "ul-progress", "aria-hidden": "true", children: /* @__PURE__ */ jsx("i", { style: { width: `${pct2}%` } }) })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "ul-rescan", children: [
    /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "sm", onClick: () => void app.usage.rescan(), children: t("src.rescan") }),
    hint && /* @__PURE__ */ jsx("span", { className: "ul-hint", children: hint }),
    usage.rescan.error && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-rescan__alert", message: t("src.rescanError", { error: usage.rescan.error }), onRetry: () => void app.usage.rescan() })
  ] });
}

// src/ui/page/overview/SourcesLayer.tsx
function sourceStatusText(src, t, now, lang) {
  if (src.status === "missing") return { text: t("src.missing"), tone: "muted" };
  if (src.status === "denied") return { text: t("src.denied"), tone: "error" };
  if (src.status === "error") return { text: src.error ? `${t("src.error")}：${src.error}` : t("src.error"), tone: "error" };
  const files = t("src.files", { n: int(src.files) });
  return { text: src.lastScanAt ? `${files} · ${ago(now - src.lastScanAt, lang)}` : files, tone: "normal" };
}
function SourcesLayer({ anchorRef }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const now = useNow(3e4);
  const ref = useRef(null);
  const close = () => app.view.set((s) => s.layer === "sources" ? { ...s, layer: null } : s);
  useDismiss([ref, anchorRef], true, close);
  useEscape(true, close);
  useEffect(() => {
    void app.usage.loadSources();
  }, [app]);
  const list = usage.sources.data ?? [];
  return /* @__PURE__ */ jsxs("div", { ref, className: "ul-layer ul-layer--sources", role: "dialog", "aria-label": t("src.title"), children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-layer__head", children: [
      /* @__PURE__ */ jsx("b", { children: t("src.title") }),
      /* @__PURE__ */ jsx("span", { children: t("src.desc") })
    ] }),
    usage.sources.phase === "error" && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-layer__alert", message: t("src.loadError", { error: usage.sources.error ?? "" }), onRetry: () => void app.usage.loadSources() }),
    usage.sources.phase === "loading" && !list.length ? /* @__PURE__ */ jsx("p", { className: "ul-layer__loading", children: /* @__PURE__ */ jsx(Spinner, {}) }) : /* @__PURE__ */ jsx("ul", { className: "ul-src", children: list.map((src) => {
      const excluded = prefs.excludedEngines.includes(src.engine);
      const st = sourceStatusText(src, t, now, lang);
      return /* @__PURE__ */ jsxs("li", { className: cx(excluded && "is-off"), children: [
        /* @__PURE__ */ jsx("i", { className: cx("ul-src__dot", `is-${src.status}`), "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs("div", { className: "ul-src__t", children: [
          /* @__PURE__ */ jsx("b", { children: src.label }),
          src.roots.map((r) => /* @__PURE__ */ jsx("code", { title: r, children: r }, r)),
          src.env && /* @__PURE__ */ jsx("small", { children: t("src.env", { env: src.env }) })
        ] }),
        /* @__PURE__ */ jsx("span", { className: cx("ul-src__st", st.tone === "muted" && "ul-muted", st.tone === "error" && "ul-error-text"), children: excluded ? t("src.excluded") : st.text })
      ] }, src.engine);
    }) }),
    /* @__PURE__ */ jsx("footer", { className: "ul-layer__foot", children: /* @__PURE__ */ jsx(RescanControl, { hint: t("src.rescanHint") }) })
  ] });
}

// src/ui/page/UsagePage.tsx
function PageHeader() {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const view = useStore(app.view);
  const alert = useAlert(prefs, limits);
  const isLimits = view.page === "limits";
  const anchorRef = useRef(null);
  const refreshLimits = async () => {
    await app.limits.fetch(true);
    if (anyProviderFailed(app.limits.store.get())) throw new Error("limits refresh failed");
  };
  return /* @__PURE__ */ jsxs("header", { className: "ul-phead", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-phead__l", children: [
      /* @__PURE__ */ jsx("h2", { children: t("page.title") }),
      /* @__PURE__ */ jsx(
        Segmented,
        {
          role: "tablist",
          className: "ul-itabs",
          label: t("page.tabs"),
          value: view.page,
          onChange: (page) => app.view.set((s) => setPage(s, page)),
          options: [
            { value: "overview", label: t("page.overview") },
            {
              value: "limits",
              label: t("page.limits"),
              badge: alert?.level ? /* @__PURE__ */ jsxs(Badge, { tone: alert.level === "danger" ? "error" : "neutral", className: cx("ul-alert-badge", `is-${alert.level}`), children: [
                alert.pct,
                "%"
              ] }) : null
            }
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "ul-phead__r", ref: anchorRef, children: isLimits ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(RefreshButton, { onRefresh: refreshLimits }),
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "ghost",
          className: cx("ul-icon-btn", view.layer === "bell" && "is-on"),
          "aria-label": t("bell.label"),
          title: t("bell.label"),
          "aria-expanded": view.layer === "bell",
          "aria-haspopup": "dialog",
          "data-layer-anchor": "bell",
          onClick: () => app.view.set((s) => toggleLayer(s, "bell")),
          children: /* @__PURE__ */ jsx(Icon, { name: prefs.alerts.on ? "bell" : "bellOff" })
        }
      ),
      /* @__PURE__ */ jsx(Button, { variant: "ghost", className: "ul-icon-btn", "aria-label": t("common.settings"), title: t("common.settings"), onClick: () => app.openSettings(), children: /* @__PURE__ */ jsx(Icon, { name: "sliders" }) }),
      view.layer === "bell" && /* @__PURE__ */ jsx(BellLayer, { anchorRef })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs(
        Button,
        {
          variant: "secondary",
          className: cx(view.layer === "sources" && "is-on"),
          "aria-expanded": view.layer === "sources",
          "aria-haspopup": "dialog",
          "data-layer-anchor": "sources",
          onClick: () => app.view.set((s) => toggleLayer(s, "sources")),
          children: [
            /* @__PURE__ */ jsx(Icon, { name: "db", size: 14 }),
            t("page.sources")
          ]
        }
      ),
      /* @__PURE__ */ jsx(RefreshButton, { onRefresh: () => app.usage.reload().then(() => {
        const err = app.usage.store.get().error;
        if (err) throw new Error(err);
      }) }),
      view.layer === "sources" && /* @__PURE__ */ jsx(SourcesLayer, { anchorRef })
    ] }) })
  ] });
}
function UsagePage() {
  const app = useApp();
  const rootRef = useRef(null);
  const visible = useElementVisible(rootRef);
  const view = useStore(app.view);
  useEffect(() => {
    app.limits.setVisible("page", visible && view.page === "limits");
  }, [app, visible, view.page]);
  useEffect(() => () => app.limits.setVisible("page", false), [app]);
  useEffect(() => {
    if (visible) void app.usage.loadWorkspaces();
    else hideTip();
  }, [app, visible]);
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: "ul-root ul-page", children: [
    /* @__PURE__ */ jsx("div", { className: "ul-page__scroll", onScroll: hideTip, children: /* @__PURE__ */ jsxs("div", { className: "ul-page__in", children: [
      /* @__PURE__ */ jsx(PageHeader, {}),
      view.page === "overview" ? /* @__PURE__ */ jsx(Overview, {}) : /* @__PURE__ */ jsx(LimitsPage, {})
    ] }) }),
    view.page === "overview" && view.drawer && /* @__PURE__ */ jsx(ProjectDrawer, { projectId: view.drawer }),
    /* @__PURE__ */ jsx(ChartTip, {})
  ] });
}

// src/ui/settings/layout.tsx
function Row({ label, desc, children: children2, htmlFor }) {
  return /* @__PURE__ */ jsxs("div", { className: "ul-srow", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-srow__t", children: [
      htmlFor ? /* @__PURE__ */ jsx("label", { htmlFor, children: label }) : /* @__PURE__ */ jsx("b", { children: label }),
      desc && /* @__PURE__ */ jsx("p", { children: desc })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "ul-srow__c", children: children2 })
  ] });
}
function Card({ title, children: children2 }) {
  return /* @__PURE__ */ jsxs("section", { className: "ul-scard", children: [
    /* @__PURE__ */ jsx("h3", { children: title }),
    children2
  ] });
}

// src/ui/settings/SettingsData.tsx
var TOKENTRACKER_URL = "https://github.com/xiufengsun/tokentracker";
var NOTICES_URL = "https://github.com/zhukunpenglinyutong/ccgui-plugin-usage-limits/blob/main/THIRD_PARTY_NOTICES.md";
function SourcesCard() {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const now = useNow(3e4);
  const list = usage.sources.data ?? [];
  return /* @__PURE__ */ jsxs(Card, { title: t("set.sources"), children: [
    usage.sources.phase === "error" && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-scard__alert", message: t("src.loadError", { error: usage.sources.error ?? "" }), onRetry: () => void app.usage.loadSources() }),
    usage.sources.phase === "loading" && !list.length && /* @__PURE__ */ jsx("p", { className: "ul-scard__loading", children: /* @__PURE__ */ jsx(Spinner, {}) }),
    list.length > 0 && /* @__PURE__ */ jsxs("div", { className: "ul-srclist", children: [
      list.map((src) => {
        const included = !prefs.excludedEngines.includes(src.engine);
        const st = sourceStatusText(src, t, now, lang);
        return /* @__PURE__ */ jsxs("div", { className: cx("ul-srcrow", !included && "is-off"), children: [
          /* @__PURE__ */ jsx("i", { className: cx("ul-src__dot", `is-${src.status}`), "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("b", { children: src.label }),
          /* @__PURE__ */ jsx("code", { title: src.roots.join("\n"), children: src.roots[0] ?? "" }),
          /* @__PURE__ */ jsx("span", { className: cx("ul-srcrow__st", st.tone === "muted" && "ul-muted", st.tone === "error" && "ul-error-text"), children: st.text }),
          /* @__PURE__ */ jsx(
            Switch,
            {
              checked: included,
              label: t("set.include", { name: src.label }),
              onChange: () => app.prefs.update((p2) => ({ ...p2, excludedEngines: toggleInList(p2.excludedEngines, src.engine) }))
            }
          )
        ] }, src.engine);
      }),
      /* @__PURE__ */ jsx("p", { className: "ul-srclist__note", children: t("set.excludeNote") })
    ] }),
    /* @__PURE__ */ jsx(Row, { label: t("set.rescan"), desc: t("set.rescanDesc"), children: /* @__PURE__ */ jsx(RescanControl, {}) })
  ] });
}
function PricesCard() {
  const app = useApp();
  const { t } = app;
  const { prefs, usage } = useAll(app);
  const update = useActionFeedback();
  const info = usage.prices.data;
  const desc = info ? `${t(info.source === "online" ? "set.priceOnline" : "set.priceBundled", { date: info.snapshotDate, n: info.models.toLocaleString("en-US") })}${info.updatedAt ? ` · ${t("set.priceUpdatedAt", { at: stamp(info.updatedAt) })}` : ""}` : usage.prices.phase === "loading" ? "…" : "";
  return /* @__PURE__ */ jsxs(Card, { title: t("set.prices"), children: [
    usage.prices.phase === "error" && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-scard__alert", message: t("set.priceError", { error: usage.prices.error ?? "" }), onRetry: () => void app.usage.loadPrices() }),
    /* @__PURE__ */ jsx(Row, { label: t("set.priceTable"), desc, children: /* @__PURE__ */ jsxs(
      Button,
      {
        variant: "secondary",
        size: "sm",
        disabled: update.feedback === "running" || usage.priceUpdate.running,
        "aria-busy": update.feedback === "running" || void 0,
        onClick: () => void update.run(() => app.usage.updatePrices(true)),
        children: [
          /* @__PURE__ */ jsx(FeedbackIcon, { icon: "refresh", feedback: update.feedback, size: 13 }),
          t("set.updateNow")
        ]
      }
    ) }),
    usage.priceUpdate.error && /* @__PURE__ */ jsx(InlineAlert, { className: "ul-scard__alert", message: t("set.priceUpdateError", { error: usage.priceUpdate.error }) }),
    /* @__PURE__ */ jsx(
      Row,
      {
        label: t("set.priceAuto"),
        desc: /* @__PURE__ */ jsxs(Fragment, { children: [
          t("set.priceAutoDesc"),
          usage.priceUpdate.lastError && /* @__PURE__ */ jsx("span", { className: "ul-error-text ul-block", role: "alert", children: t("set.priceLastError", { error: usage.priceUpdate.lastError }) })
        ] }),
        children: /* @__PURE__ */ jsx(Switch, { checked: prefs.priceAuto, label: t("set.priceAuto"), onChange: (priceAuto) => app.prefs.update((p2) => ({ ...p2, priceAuto })) })
      }
    ),
    /* @__PURE__ */ jsx(Row, { label: t("set.noPrice"), desc: t("set.noPriceDesc"), children: usage.unknownModels.length ? /* @__PURE__ */ jsx("span", { className: "ul-chips", children: usage.unknownModels.map((m) => /* @__PURE__ */ jsx("code", { className: "ul-mono ul-chip-code", title: m, children: m }, m)) }) : /* @__PURE__ */ jsx("span", { className: "ul-muted", children: t("set.noPriceNone") }) })
  ] });
}
function PrivacyCard() {
  const app = useApp();
  const { t, raw } = app;
  const link = (label, url, showUrl) => /* @__PURE__ */ jsxs("span", { className: "ul-credit", title: url, children: [
    /* @__PURE__ */ jsx("b", { children: label }),
    showUrl && /* @__PURE__ */ jsx("code", { className: "ul-credit__url", children: url.replace(/^https:\/\//, "") }),
    /* @__PURE__ */ jsx(CopyButton, { text: url, label: t("common.copyLink"), copiedLabel: t("common.linkCopied") })
  ] });
  return /* @__PURE__ */ jsxs(Card, { title: t("set.privacy"), children: [
    /* @__PURE__ */ jsx("p", { className: "ul-sp", children: t("set.privacy1") }),
    /* @__PURE__ */ jsx("p", { className: "ul-sp", children: t("set.privacy2") }),
    /* @__PURE__ */ jsx("p", { className: "ul-sp", children: templateParts(raw("set.privacy3")).map(
      (part, i) => part.key === "tokentracker" ? /* @__PURE__ */ jsx("span", { children: link("TokenTracker", TOKENTRACKER_URL, true) }, i) : part.key === "notices" ? /* @__PURE__ */ jsx("span", { children: link("THIRD_PARTY_NOTICES.md", NOTICES_URL, false) }, i) : /* @__PURE__ */ jsx("span", { children: part.text }, i)
    ) })
  ] });
}
function DataCards() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SourcesCard, {}),
    /* @__PURE__ */ jsx(PricesCard, {}),
    /* @__PURE__ */ jsx(PrivacyCard, {})
  ] });
}

// src/ui/settings/SettingsSection.tsx
function SettingsSection() {
  const app = useApp();
  const { t } = app;
  const { prefs, prefsState } = useAll(app);
  const set = (fn) => app.prefs.update(fn);
  useEffect(() => {
    void app.usage.loadSources();
    void app.usage.loadPrices();
    void app.usage.maybeAutoUpdatePrices(app.prefs.get().priceAuto);
  }, [app]);
  return /* @__PURE__ */ jsxs("div", { className: "ul-root ul-settings", children: [
    /* @__PURE__ */ jsxs("header", { className: "ul-set__head", children: [
      /* @__PURE__ */ jsx("h2", { children: t("plugin.name") }),
      /* @__PURE__ */ jsx("p", { children: t("set.head", { version: app.version }) })
    ] }),
    prefsState.saveError && /* @__PURE__ */ jsx(InlineAlert, { message: t("set.saveError", { error: prefsState.saveError }), onRetry: () => void app.prefs.flush() }),
    /* @__PURE__ */ jsxs(Card, { title: t("set.status"), children: [
      /* @__PURE__ */ jsx(Row, { label: t("set.chipMode"), htmlFor: "ul-chip-mode", children: /* @__PURE__ */ jsxs(Select, { id: "ul-chip-mode", value: prefs.chipMode, onChange: (e) => set((p2) => ({ ...p2, chipMode: e.target.value })), children: [
        /* @__PURE__ */ jsx("option", { value: "both", children: t("set.mode.both") }),
        /* @__PURE__ */ jsx("option", { value: "tokens", children: t("set.mode.tokens") }),
        /* @__PURE__ */ jsx("option", { value: "cost", children: t("set.mode.cost") }),
        /* @__PURE__ */ jsx("option", { value: "limit", children: t("set.mode.limit") })
      ] }) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.chipPeriod"), htmlFor: "ul-chip-period", children: /* @__PURE__ */ jsxs(
        Select,
        {
          id: "ul-chip-period",
          value: prefs.chipPeriod,
          disabled: prefs.chipMode === "limit",
          onChange: (e) => set((p2) => ({ ...p2, chipPeriod: e.target.value })),
          children: [
            /* @__PURE__ */ jsx("option", { value: "today", children: t("set.period.today") }),
            /* @__PURE__ */ jsx("option", { value: "7d", children: t("set.period.7d") }),
            /* @__PURE__ */ jsx("option", { value: "month", children: t("set.period.month") })
          ]
        }
      ) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.logo"), desc: t("set.logoDesc"), children: /* @__PURE__ */ jsx(Switch, { checked: prefs.logo, label: t("set.logo"), onChange: (logo) => set((p2) => ({ ...p2, logo })) }) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.motion"), desc: t("set.motionDesc"), children: /* @__PURE__ */ jsx(
        Switch,
        {
          checked: prefs.logoMotion,
          disabled: !prefs.logo,
          label: t("set.motion"),
          onChange: (logoMotion) => set((p2) => ({ ...p2, logoMotion }))
        }
      ) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.chipLimits"), desc: t("set.chipLimitsDesc"), children: /* @__PURE__ */ jsx(Switch, { checked: prefs.chipLimits, label: t("set.chipLimits"), onChange: (chipLimits) => set((p2) => ({ ...p2, chipLimits })) }) })
    ] }),
    /* @__PURE__ */ jsxs(Card, { title: t("set.limits"), children: [
      /* @__PURE__ */ jsx(Row, { label: t("set.autoRefresh"), desc: t("set.autoRefreshDesc"), htmlFor: "ul-auto-refresh", children: /* @__PURE__ */ jsxs(Select, { id: "ul-auto-refresh", value: prefs.autoRefresh, onChange: (e) => set((p2) => ({ ...p2, autoRefresh: e.target.value })), children: [
        ["5", "10", "15", "30"].map((n) => /* @__PURE__ */ jsx("option", { value: n, children: t("set.every", { n }) }, n)),
        /* @__PURE__ */ jsx("option", { value: "off", children: t("set.off") })
      ] }) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.claude"), desc: t("set.claudeDesc"), children: /* @__PURE__ */ jsx(
        Switch,
        {
          checked: prefs.providers.claude,
          label: t("set.claude"),
          onChange: (claude) => set((p2) => ({ ...p2, providers: { ...p2.providers, claude } }))
        }
      ) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.codex"), desc: t("set.codexDesc"), children: /* @__PURE__ */ jsx(Switch, { checked: prefs.providers.codex, label: t("set.codex"), onChange: (codex) => set((p2) => ({ ...p2, providers: { ...p2.providers, codex } })) }) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.alerts"), desc: t("set.alertsDesc"), children: /* @__PURE__ */ jsxs("div", { className: "ul-srow__stack", children: [
        /* @__PURE__ */ jsx(Switch, { checked: prefs.alerts.on, label: t("set.alerts"), onChange: (on) => set((p2) => ({ ...p2, alerts: { ...p2.alerts, on } })) }),
        /* @__PURE__ */ jsx(
          ThresholdChips,
          {
            value: prefs.alerts.thresholds,
            disabled: !prefs.alerts.on,
            onChange: (thresholds) => set((p2) => ({ ...p2, alerts: { ...p2.alerts, thresholds } }))
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx(Row, { label: t("set.background"), desc: t("set.backgroundDesc"), children: /* @__PURE__ */ jsx(
        Switch,
        {
          checked: prefs.alerts.background,
          label: t("set.background"),
          onChange: (background) => set((p2) => ({ ...p2, alerts: { ...p2.alerts, background } }))
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(DataCards, {})
  ] });
}

// src/ui/status/PopoverParts.tsx
function usePopoverSummary() {
  const { prefs, usage } = useAll(useApp());
  return useMemo(
    () => popoverSummary({
      daily: usage.daily,
      todayHours: usage.hourly[usage.today] ?? [],
      yesterdayHours: usage.hourly[addDays(usage.today, -1)] ?? null,
      today: usage.today,
      now: /* @__PURE__ */ new Date(),
      excluded: prefs.excludedEngines
    }),
    [usage.daily, usage.hourly, usage.today, prefs.excludedEngines]
  );
}
var SAY_INTERVAL_MS = 5e3;
var SAY_ORDER = {
  hot: ["alert", "tokens", "cost"],
  cold: ["delta", "tokens", "cost"]
};
function nextSay(mode, hot) {
  const order = hot ? SAY_ORDER.hot : SAY_ORDER.cold;
  const i = mode == null ? -1 : order.indexOf(mode);
  return order[i < 0 ? 1 : (i + 1) % order.length] ?? order[0];
}
function SayBubble({ usage, alert, s }) {
  const { t } = useApp();
  const [mode, setMode] = useState(null);
  const [manual, setManual] = useState(0);
  const hot = !!alert?.level;
  useEffect(() => {
    const id = setInterval(() => setMode((m) => nextSay(m, hot)), SAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hot, manual]);
  let fixed = null;
  if (usage.scanning && !usage.firstDay) fixed = t("say.scanning");
  else if (usage.phase === "error") fixed = t("say.error");
  else if (usage.phase === "ready" && !usage.firstDay) fixed = t("say.empty");
  if (fixed) return /* @__PURE__ */ jsx("span", { className: "ul-say", children: fixed });
  let deltaText = t("say.started");
  if (s.delta != null) {
    const pct2 = Math.round(Math.abs(s.delta) * 100);
    deltaText = pct2 < 3 ? t("say.same") : t(s.delta > 0 ? "say.more" : "say.less", { pct: pct2 });
  }
  const texts = {
    delta: deltaText,
    alert: alert?.level ? t("say.alert", { provider: PROVIDER_NAME[alert.provider], window: windowInfo(alert.window).short }) : "",
    tokens: t("say.todayTokens", { tokens: tokens(s.today.total) }),
    cost: t("say.todayCost", { cost: usd(s.today.cost) })
  };
  const order = hot ? SAY_ORDER.hot : SAY_ORDER.cold;
  const active = mode != null && order.includes(mode) ? mode : order[0];
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: "ul-say ul-say--cycle",
      title: t("say.cycle"),
      onClick: () => {
        setMode((m) => nextSay(m, hot));
        setManual((n) => n + 1);
      },
      children: texts[active]
    }
  );
}
function PopoverState({ title, body, spinning }) {
  return /* @__PURE__ */ jsxs("div", { className: "ul-pop__state", children: [
    spinning && /* @__PURE__ */ jsx(Spinner, { size: 16 }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("b", { children: title }),
      /* @__PURE__ */ jsx("p", { children: body })
    ] })
  ] });
}
function PopoverStats({ s }) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const [sel, setSel] = useState(null);
  const hmax = Math.max(1, ...s.hours);
  const hit = (x) => {
    const v = cacheHitRate(x);
    return v == null ? "—" : rate(v);
  };
  const split = (x) => t("pop.split", {
    input: tokens(x.input),
    output: tokens(x.output),
    cacheRead: tokens(x.cacheRead),
    cacheWrite: tokens(x.cacheWrite),
    hit: hit(x)
  });
  const card = (label, sum, sub, target) => /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: cx("ul-pcard", sel === target && "is-on"),
      title: split(sum),
      "aria-expanded": sel === target,
      onClick: () => setSel((cur) => cur === target ? null : target),
      children: [
        /* @__PURE__ */ jsx("span", { className: "ul-pcard__lbl", children: label }),
        /* @__PURE__ */ jsx("b", { children: tokens(sum.total) }),
        /* @__PURE__ */ jsx("span", { className: "ul-pcard__cost", children: usd(sum.cost) }),
        /* @__PURE__ */ jsx("span", { className: "ul-pcard__sub", children: sub })
      ]
    }
  );
  const picked = sel === "day" ? s.today : sel === "7d" ? s.last7 : sel === "30d" ? s.last30 : sel === "all" ? s.all : null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: cx("ul-ptoday", sel === "day" && "is-on"),
        title: split(s.today),
        "aria-expanded": sel === "day",
        onClick: () => setSel((cur) => cur === "day" ? null : "day"),
        children: [
          /* @__PURE__ */ jsxs("span", { className: "ul-ptoday__l", children: [
            /* @__PURE__ */ jsx("span", { className: "ul-ptoday__lbl", children: t("chip.today") }),
            /* @__PURE__ */ jsx("b", { className: "ul-ptoday__num", children: tokens(s.today.total) }),
            /* @__PURE__ */ jsxs("span", { className: "ul-ptoday__meta", children: [
              /* @__PURE__ */ jsx("span", { children: usd(s.today.cost) }),
              s.delta != null && /* @__PURE__ */ jsxs("span", { className: "ul-delta", children: [
                s.delta >= 0 ? "↑" : "↓",
                " ",
                Math.abs(Math.round(s.delta * 100)),
                "%",
                /* @__PURE__ */ jsx("span", { children: t("pop.vsYesterday") })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "ul-spark", "aria-hidden": "true", children: s.hours.map((h, i) => /* @__PURE__ */ jsx("i", { className: cx(i > s.nowHour && "is-future"), style: { height: `${Math.max(4, h / hmax * 100)}%` } }, i)) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "ul-pcards", children: [
      card(t("pop.last7"), s.last7, t("pop.activeDays", { n: s.active7 }), "7d"),
      card(t("pop.last30"), s.last30, t("pop.dailyAvg", { v: tokens(s.last30.total / 30) }), "30d"),
      card(t("pop.all"), s.all, usage.firstDay ? t("pop.since", { date: dateShort(usage.firstDay, lang) }) : "", "all")
    ] }),
    picked && /* @__PURE__ */ jsx("div", { className: "ul-pdetail", role: "region", "aria-label": t("pop.splitTitle"), children: [
      ["col.input", tokens(picked.input)],
      ["col.output", tokens(picked.output)],
      ["col.cacheRead", tokens(picked.cacheRead)],
      ["col.cacheWrite", tokens(picked.cacheWrite)],
      ["col.cacheHit", hit(picked)]
    ].map(([key, v]) => /* @__PURE__ */ jsxs("span", { children: [
      /* @__PURE__ */ jsx("i", { children: t(key) }),
      /* @__PURE__ */ jsx("b", { children: v })
    ] }, key)) })
  ] });
}
function ProviderLine({ text, cmd, error }) {
  return /* @__PURE__ */ jsx("p", { className: cx("ul-pprov__state", error && "is-error"), role: error ? "alert" : void 0, children: templateParts(text).map((part, i) => part.key === "cmd" && cmd ? /* @__PURE__ */ jsx("code", { children: cmd }, i) : /* @__PURE__ */ jsx("span", { children: part.text }, i)) });
}
function PopoverProvider({ p: p2, now }) {
  const { t, raw, lang } = useApp();
  const stale = isStale(p2);
  let body;
  if (p2.status === "signedOut") body = /* @__PURE__ */ jsx(ProviderLine, { text: raw("lim.signedOutLine"), cmd: loginCommand(p2.id) });
  else if (p2.status === "expired") body = /* @__PURE__ */ jsx(ProviderLine, { text: raw("lim.expiredLine"), cmd: loginCommand(p2.id) });
  else if (p2.status === "error" && !hasWindows(p2)) body = /* @__PURE__ */ jsx(ProviderLine, { error: true, text: t("lim.errorLine", { error: p2.error ?? "" }) });
  else {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      p2.windows.map((w) => /* @__PURE__ */ jsx(LimitRow, { provider: p2, w, now, compact: true, stale }, w.id)),
      p2.status === "rateLimited" && /* @__PURE__ */ jsx(ProviderLine, { text: t("lim.rateLimitedLine") }),
      p2.status === "offline" && /* @__PURE__ */ jsx(ProviderLine, { error: true, text: t("lim.offlineLine", { host: p2.host }) }),
      p2.status === "error" && /* @__PURE__ */ jsx(ProviderLine, { error: true, text: t("lim.errorLine", { error: p2.error ?? "" }) })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "ul-pprov", children: [
    /* @__PURE__ */ jsxs("div", { className: "ul-pprov__head", children: [
      /* @__PURE__ */ jsx(ProviderLogo, { id: p2.id }),
      /* @__PURE__ */ jsx("b", { children: PROVIDER_NAME[p2.id] }),
      p2.plan && /* @__PURE__ */ jsx(Badge, { tone: "neutral", children: p2.plan }),
      stale && p2.fetchedAt != null && /* @__PURE__ */ jsx("span", { className: "ul-pprov__ago", children: t("lim.dataAgo", { ago: ago(now - p2.fetchedAt, lang) }) })
    ] }),
    body
  ] });
}
function PopoverLimits({ now }) {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const enabled = enabledProviders(prefs);
  const providers = limits.providers.filter((p2) => enabled.includes(p2.id));
  return /* @__PURE__ */ jsxs("section", { className: "ul-plim", "aria-label": t("common.limits"), children: [
    /* @__PURE__ */ jsx("header", { className: "ul-plim__head", children: /* @__PURE__ */ jsx("span", { children: t("common.limits") }) }),
    limits.phase === "error" && !providers.length ? /* @__PURE__ */ jsx("p", { className: "ul-pprov__state is-error", role: "alert", children: t("lim.loadError", { error: limits.error ?? "" }) }) : limits.phase === "loading" || limits.phase === "idle" ? /* @__PURE__ */ jsxs("div", { "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--row" }),
      /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--row" })
    ] }) : providers.map((p2) => /* @__PURE__ */ jsx(PopoverProvider, { p: p2, now }, p2.id))
  ] });
}

// src/ui/status/Popover.tsx
var WIDTH = 400;
var AUTO_REFRESH_AFTER_MS = 6e4;
function computePos(anchor) {
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 16);
  const left = Math.min(Math.max(8, r.left - 4), window.innerWidth - width - 8);
  return { left, bottom: window.innerHeight - r.top + 6, width, maxHeight: Math.max(160, r.top - 16) };
}
function Popover({ anchorRef, onClose }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage, limits } = useAll(app);
  const now = useNow(3e4);
  const popRef = useRef(null);
  const [pos, setPos] = useState(() => computePos(anchorRef.current));
  const alert = useAlert(prefs, limits);
  const summary = usePopoverSummary();
  const autoFeedback = useRunningFeedback(usage.refreshing, !!usage.refreshError);
  useLayoutEffect(() => {
    const update = () => setPos(computePos(anchorRef.current));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [anchorRef]);
  useEffect(() => {
    popRef.current?.focus({ preventScroll: true });
    app.limits.setVisible("popover", true);
    const s = app.usage.store.get();
    if (s.phase === "ready" && !s.scanning && (s.scannedAt == null || Date.now() - s.scannedAt > AUTO_REFRESH_AFTER_MS)) {
      app.usage.refresh().catch(() => void 0);
    }
    app.usage.ensureHours(addDays(s.today, -1));
    return () => app.limits.setVisible("popover", false);
  }, [app]);
  useDismiss([popRef, anchorRef], true, () => onClose(false));
  useEscape(true, () => onClose(true));
  const go = (page) => {
    onClose(false);
    app.openPage(page);
  };
  const scanning = usage.scanning && !usage.firstDay;
  const hasProviders = enabledProviders(prefs).length > 0;
  const refreshAll = async () => {
    await Promise.all([app.usage.refresh(), hasProviders ? app.limits.fetch(true) : Promise.resolve()]);
    if (anyProviderFailed(app.limits.store.get())) throw new Error("limits refresh failed");
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: popRef,
      className: "ul-root ul-pop",
      role: "dialog",
      "aria-label": t("pop.label"),
      tabIndex: -1,
      style: pos ? { left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight } : { visibility: "hidden" },
      children: [
        /* @__PURE__ */ jsxs("header", { className: "ul-pop__head", children: [
          prefs.logo ? /* @__PURE__ */ jsx(BrandMark, { size: 26, running: usage.running && prefs.logoMotion, still: !prefs.logoMotion }) : /* @__PURE__ */ jsx(Icon, { name: "gauge", size: 24, className: "ul-pop__glyph" }),
          /* @__PURE__ */ jsxs("div", { className: "ul-pop__say", children: [
            /* @__PURE__ */ jsx(SayBubble, { usage, alert, s: summary }),
            /* @__PURE__ */ jsx("span", { className: "ul-pop__ago", children: usage.scannedAt ? t("pop.updated", { ago: ago(now - usage.scannedAt, lang) }) : t("pop.never") })
          ] }),
          /* @__PURE__ */ jsx(RefreshButton, { onRefresh: refreshAll, feedback: autoFeedback }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "ghost",
              className: "ul-icon-btn",
              "aria-label": t("common.settings"),
              title: t("common.settings"),
              onClick: () => {
                onClose(false);
                app.openSettings();
              },
              children: /* @__PURE__ */ jsx(Icon, { name: "sliders" })
            }
          )
        ] }),
        usage.refreshError && usage.phase === "ready" && /* @__PURE__ */ jsx(
          InlineAlert,
          {
            className: "ul-pop__alert",
            message: t("common.refreshError", { error: usage.refreshError }),
            retrying: usage.refreshing,
            onRetry: () => void app.usage.refresh().catch(() => void 0)
          }
        ),
        usage.phase === "error" ? /* @__PURE__ */ jsx(InlineAlert, { className: "ul-pop__alert", message: t("common.loadError", { error: usage.error ?? "" }), onRetry: () => void app.usage.reload() }) : scanning ? /* @__PURE__ */ jsx(PopoverState, { spinning: true, title: t("pop.scanningTitle", { pct: scanPct(usage) }), body: t("pop.scanningBody", { done: int(usage.progress?.done ?? 0), total: int(usage.progress?.total ?? 0) }) }) : isEmpty(usage) ? /* @__PURE__ */ jsx(PopoverState, { title: t("pop.emptyTitle"), body: t("pop.emptyBody") }) : usage.phase === "loading" ? /* @__PURE__ */ jsxs("div", { className: "ul-pop__skel", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--today" }),
          /* @__PURE__ */ jsx("span", { className: "ul-skel ul-skel--cards" })
        ] }) : /* @__PURE__ */ jsx(PopoverStats, { s: summary }),
        hasProviders && /* @__PURE__ */ jsx(PopoverLimits, { now }),
        /* @__PURE__ */ jsxs("footer", { className: "ul-pop__foot", children: [
          /* @__PURE__ */ jsxs(Button, { variant: "ghost", size: "sm", className: "ul-linkbtn", onClick: () => go("overview"), children: [
            t("pop.overview"),
            /* @__PURE__ */ jsx(Icon, { name: "arrowR", size: 13 })
          ] }),
          /* @__PURE__ */ jsxs(Button, { variant: "ghost", size: "sm", className: "ul-linkbtn", onClick: () => go("limits"), children: [
            t("pop.limits"),
            /* @__PURE__ */ jsx(Icon, { name: "arrowR", size: 13 })
          ] })
        ] })
      ]
    }
  );
}

// src/ui/status/StatusChip.tsx
var PERIOD_KEY = { today: "chip.today", "7d": "chip.7d", month: "chip.month" };
function LimitTag({ tag }) {
  const label = tag.windows.map((x) => `${windowInfo(x.window).short} ${x.pct}%`).join(" · ");
  return /* @__PURE__ */ jsxs("span", { className: cx("ul-chip__lim", tag.level && `is-${tag.level}`), title: `${PROVIDER_NAME[tag.provider]} ${label}`, children: [
    /* @__PURE__ */ jsx(ProviderLogo, { id: tag.provider, size: 14 }),
    tag.windows.map((x, i) => /* @__PURE__ */ jsxs("span", { className: "ul-chip__lim-pair", children: [
      i > 0 ? " " : null,
      /* @__PURE__ */ jsx("span", { className: "ul-chip__lim-win", children: windowInfo(x.window).short }),
      " ",
      /* @__PURE__ */ jsxs("b", { children: [
        x.pct,
        "%"
      ] })
    ] }, x.window.id))
  ] });
}
function StatusChip() {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage, limits } = useAll(app);
  const view = useStore(app.view);
  const now = useNow(3e4);
  const chipRef = useRef(null);
  const tags = useProviderTags(prefs, limits);
  const totals = useChipTotals(prefs, usage);
  const open = view.popover;
  const toggle = () => app.view.set((s) => ({ ...s, popover: !s.popover }));
  const close = (refocus) => {
    app.view.set((s) => s.popover ? { ...s, popover: false } : s);
    if (refocus) chipRef.current?.focus();
  };
  const glyph = prefs.logo ? /* @__PURE__ */ jsx(BrandMark, { size: 14, running: usage.running && prefs.logoMotion, still: !prefs.logoMotion }) : /* @__PURE__ */ jsx(Icon, { name: "gauge", size: 14 });
  const scanning = usage.scanning && usage.phase === "ready" && !usage.firstDay;
  const showTags = !scanning && (prefs.chipMode === "limit" || prefs.chipLimits);
  const tagNodes = showTags ? tags.map((tag) => /* @__PURE__ */ jsx(LimitTag, { tag }, tag.provider)) : null;
  let body;
  let title;
  if (scanning) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Spinner, { size: 13 }),
      /* @__PURE__ */ jsx("span", { children: t("chip.scanning", { pct: scanPct(usage) }) })
    ] });
    title = t("chip.scanningTitle");
  } else if (prefs.chipMode === "limit") {
    body = tagNodes;
    title = t("chip.click");
    if (!tags.length) {
      body = /* @__PURE__ */ jsxs(Fragment, { children: [
        glyph,
        /* @__PURE__ */ jsx("span", { className: "ul-chip__muted", children: limits.phase === "loading" ? t("chip.loading") : t("chip.noLimit") })
      ] });
    }
  } else if (isEmpty(usage)) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      glyph,
      /* @__PURE__ */ jsx("span", { className: "ul-chip__muted", children: t("chip.empty") }),
      tagNodes
    ] });
    title = t("chip.emptyTitle");
  } else if (!totals) {
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      glyph,
      /* @__PURE__ */ jsx("span", { className: "ul-chip__muted", children: usage.phase === "error" ? t("chip.error") : t("chip.loading") })
    ] });
    title = usage.error ? t("common.loadError", { error: usage.error }) : t("chip.click");
  } else {
    const label = t(PERIOD_KEY[prefs.chipPeriod]);
    body = /* @__PURE__ */ jsxs(Fragment, { children: [
      glyph,
      /* @__PURE__ */ jsx("span", { className: "ul-chip__lbl", children: label }),
      prefs.chipMode !== "cost" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("b", { children: tokens(totals.total) }),
        /* @__PURE__ */ jsx("span", { className: "ul-chip__unit", children: t("chip.tokens") })
      ] }),
      prefs.chipMode === "both" && /* @__PURE__ */ jsx("span", { className: "ul-chip__sep", "aria-hidden": "true" }),
      prefs.chipMode !== "tokens" && /* @__PURE__ */ jsx("b", { children: usd(totals.cost) }),
      tagNodes && /* @__PURE__ */ jsx("span", { className: "ul-chip__sep", "aria-hidden": "true" }),
      tagNodes
    ] });
    const updated = usage.scannedAt ? ` · ${t("chip.updated", { ago: ago(now - usage.scannedAt, lang) })}` : "";
    title = `${t("chip.title", { label, tokens: tokens(totals.total), cost: usd(totals.cost) })}${updated}`;
  }
  for (const tag of tags) {
    title += `
${PROVIDER_NAME[tag.provider]} ${tag.windows.map((x) => `${windowInfo(x.window).short} ${x.pct}%`).join(" · ")}`;
  }
  title += `
${t("chip.click")}`;
  return /* @__PURE__ */ jsxs("span", { className: "ul-root ul-chip-wrap", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        ref: chipRef,
        type: "button",
        className: cx("ul-chip", open && "is-open"),
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        title,
        onClick: toggle,
        children: body
      }
    ),
    open && /* @__PURE__ */ jsx(Popover, { anchorRef: chipRef, onClose: close })
  ] });
}

// src/main.tsx
var TAB_KEY = "usage";
var SETTINGS_KEY = "settings";
var chipShowsLimits = (p2) => enabledProviders(p2).length > 0 && (p2.chipMode === "limit" || p2.chipLimits);
var limitsConfig = (p2) => ({
  enabled: enabledProviders(p2),
  visibleMs: autoRefreshMs(p2.autoRefresh),
  background: p2.alerts.background
});
function createApp(ctx) {
  const lang = langOf(ctx.host?.locale);
  const { t, raw } = createT(lang);
  const prefs = createPrefs(ctx.storage);
  const view = createStore(initialView(todayKey(Date.now())));
  const usage = createUsageService({
    ctx,
    chipScope: () => ({ period: prefs.get().chipPeriod, excluded: prefs.get().excludedEngines })
  });
  const limits = createLimitsService({ ctx, config: limitsConfig(prefs.get()) });
  const openPage = (page) => {
    if (page) view.set((s) => setPage(s, page));
    view.set((s) => s.popover ? { ...s, popover: false } : s);
    try {
      ctx.ui.openCenterTab(TAB_KEY);
    } catch {
      ctx.ui.openSettings(SETTINGS_KEY);
    }
  };
  const openSettings = () => {
    view.set((s) => s.popover ? { ...s, popover: false } : s);
    ctx.ui.openSettings(SETTINGS_KEY);
  };
  return { ctx, lang, t, raw, version: ctx.version, prefs, usage, limits, view, openPage, openSettings };
}
function registerSurfaces(app) {
  const { ctx, t } = app;
  const wrap = (Inner) => function Surface() {
    return /* @__PURE__ */ jsx(AppProvider, { app, children: /* @__PURE__ */ jsx(Inner, {}) });
  };
  const disposers = [];
  disposers.push(ctx.ui.registerStatusBarItem({ key: "chip", zone: "start", order: 10, component: wrap(StatusChip) }));
  disposers.push(ctx.ui.registerCenterTab({ key: TAB_KEY, title: () => t("tab.title"), icon: GaugeIcon, component: wrap(UsagePage) }));
  disposers.push(ctx.ui.registerSettingsSection({ key: SETTINGS_KEY, label: () => t("plugin.name"), icon: GaugeIcon, component: wrap(SettingsSection) }));
  disposers.push(
    ctx.ui.registerCommand({ key: "open", title: () => t("cmd.open"), keywords: () => ["usage", "token", "cost", "用量", "费用"], run: () => app.openPage("overview") })
  );
  disposers.push(
    ctx.ui.registerCommand({ key: "open-limits", title: () => t("cmd.openLimits"), keywords: () => ["limit", "quota", "限额", "claude", "codex"], run: () => app.openPage("limits") })
  );
  disposers.push(
    ctx.ui.registerCommand({ key: "refresh", title: () => t("cmd.refresh"), keywords: () => ["usage", "refresh", "刷新"], run: () => void app.usage.refresh().catch(() => void 0) })
  );
  disposers.push(ctx.events.on("usage://updated", () => app.limits.poke()));
  disposers.push(ctx.events.on("usage://done", () => app.limits.poke()));
  let badge = null;
  let navDispose = null;
  const registerNav = () => {
    navDispose?.();
    navDispose = ctx.ui.registerSidebarNav({
      key: "nav",
      label: () => t("nav.label"),
      icon: GaugeIcon,
      order: 20,
      badge: () => badge,
      onOpen: () => app.openPage()
    });
  };
  const syncBadge = () => {
    const alert = computeAlert(app.prefs.get(), app.limits.store.get());
    const next = alert?.level ? `${alert.pct}%` : null;
    if (next === badge && navDispose) return;
    badge = next;
    registerNav();
  };
  syncBadge();
  disposers.push(app.limits.store.subscribe(syncBadge));
  disposers.push(app.prefs.store.subscribe(syncBadge));
  disposers.push(() => navDispose?.());
  return () => {
    for (const d of disposers.splice(0).reverse()) d();
  };
}
function watchPrefs(app) {
  let prev = app.prefs.get();
  return app.prefs.store.subscribe(() => {
    const next = app.prefs.get();
    if (next === prev) return;
    const before = prev;
    prev = next;
    if (limitsConfig(before).enabled.join() !== limitsConfig(next).enabled.join() || before.autoRefresh !== next.autoRefresh || before.alerts.background !== next.alerts.background) {
      app.limits.configure(limitsConfig(next));
    }
    app.limits.setVisible("chip", chipShowsLimits(next));
    if (!before.priceAuto && next.priceAuto) void app.usage.maybeAutoUpdatePrices(true);
  });
}
function activate(rawCtx) {
  bindReact(rawCtx.react);
  initAppContext();
  const ctx = rawCtx;
  const app = createApp(ctx);
  const unregister = registerSurfaces(app);
  const unwatch = watchPrefs(app);
  let disposed = false;
  app.usage.init();
  void app.prefs.load().then(() => {
    if (disposed) return;
    app.limits.configure(limitsConfig(app.prefs.get()));
    app.limits.fetch(false).catch(() => void 0);
    app.limits.setVisible("chip", chipShowsLimits(app.prefs.get()));
    void app.usage.maybeAutoUpdatePrices(app.prefs.get().priceAuto);
  });
  return () => {
    disposed = true;
    unwatch();
    unregister();
    app.usage.dispose();
    app.limits.dispose();
    app.prefs.dispose();
  };
}
export {
  activate as default
};
