/**
 * Mock CC GUI host frame for visual checks: sidebar (plugin nav + badge),
 * center tab strip (keep-alive plugin tab, hidden with visibility when
 * inactive — like the real host), settings page, bottom status bar with a
 * "start" zone. Uses the real React/ReactDOM UMD builds (preview only).
 */
import activate from "../main.js";
import { createFakeCtx } from "./fake-ctx.js";

const React = window.React;
const h = React.createElement;
const params = new URLSearchParams(location.search);
if (params.get("dark") === "1") document.documentElement.classList.add("dark");
if (params.get("reduced") === "1") document.documentElement.classList.add("reduced-motion");

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push(`unhandled: ${e.reason?.message ?? e.reason}`));
const origError = console.error;
console.error = (...args) => {
  window.__errors.push(args.map(String).join(" "));
  origError(...args);
};

/* ---- host state ---------------------------------------------------------- */
const state = { regs: { status: [], tab: [], settings: [], nav: [], command: [] }, tabOpen: false, active: "chat", settingsKey: null };
const listeners = new Set();
const notify = () => {
  for (const l of [...listeners]) l();
};
const hostApi = {
  register(kind, def) {
    const key = def.key ?? kind;
    state.regs = { ...state.regs, [kind]: [...state.regs[kind].filter((d) => (d.key ?? kind) !== key), def] };
    notify();
    return () => {
      state.regs = { ...state.regs, [kind]: state.regs[kind].filter((d) => d !== def) };
      notify();
    };
  },
  openTab() {
    if (!state.regs.tab.length) throw new Error("center tab not registered");
    state.tabOpen = true;
    state.active = "usage";
    notify();
  },
  openSettings(key) {
    state.active = "settings";
    state.settingsKey = key ?? null;
    notify();
  },
};
const useHost = () => {
  const [, set] = React.useState(0);
  React.useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return state;
};

const { ctx, calls, storage } = createFakeCtx(params, hostApi);
window.__calls = calls;
window.__storage = storage;
window.__ctx = ctx;
window.__dispose = activate(ctx);
window.__host = { state, notify, open: (v) => ((state.active = v), v === "usage" && (state.tabOpen = true), notify()) };

/* ---- frame ---------------------------------------------------------------- */
const Boundary = class extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? h("div", { className: "h-crash", role: "alert" }, `Plugin crashed: ${this.state.error.message}`) : this.props.children;
  }
};

function Sidebar() {
  const s = useHost();
  return h(
    "aside",
    { className: "h-side" },
    h("div", { className: "h-side__item" }, "✎  新对话"),
    h("div", { className: "h-side__item" }, "⌕  搜索"),
    h("div", { className: "h-side__item" }, "⚡  自动化"),
    ...s.regs.nav.map((def) => {
      const Icon = def.icon;
      const badge = def.badge?.();
      return h(
        "button",
        { key: def.key, className: `h-side__item h-nav${s.active === "usage" ? " is-active" : ""}`, onClick: def.onOpen, "data-testid": "sidebar-usage" },
        Icon ? h(Icon, { className: "h-ic" }) : null,
        h("span", null, def.label()),
        badge != null ? h("span", { className: "h-badge", "data-testid": "sidebar-badge" }, badge) : null,
      );
    }),
    h("p", { className: "h-side__label" }, "工作区"),
    h("div", { className: "h-side__ws" }, "desktop-cc-gui"),
    h("div", { className: "h-side__sess" }, "修复状态栏缩放错位"),
    h("div", { className: "h-side__ws" }, "jetbrains-cc-gui"),
  );
}

function Tabs() {
  const s = useHost();
  const tab = s.regs.tab[0];
  const go = (v) => window.__host.open(v);
  return h(
    "div",
    { className: "h-tabs" },
    h("button", { className: `h-tab${s.active === "chat" ? " is-active" : ""}`, onClick: () => go("chat") }, "修复状态栏缩放错位"),
    s.tabOpen && tab ? h("button", { className: `h-tab${s.active === "usage" ? " is-active" : ""}`, onClick: () => go("usage"), "data-testid": "tab-usage" }, tab.title()) : null,
    s.active === "settings" ? h("button", { className: "h-tab is-active" }, "设置") : null,
  );
}

function Center() {
  const s = useHost();
  const tab = s.regs.tab[0];
  const section = s.regs.settings[0];
  return h(
    "div",
    { className: "h-center" },
    h("div", { className: `h-surface${s.active === "chat" ? "" : " is-hidden"}` }, h("div", { className: "h-chat" }, h("div", { className: "h-bubble" }, "状态栏缩放按钮在 125% 时和版本号挤在一起，帮我看一下。"))),
    s.tabOpen && tab ? h("div", { className: `h-surface${s.active === "usage" ? "" : " is-hidden"}`, "data-testid": "usage-surface" }, h(Boundary, null, h(tab.component))) : null,
    s.active === "settings" && section
      ? h(
          "div",
          { className: "h-surface h-settings" },
          h("nav", { className: "h-settings__nav" }, h("p", null, "插件"), h("span", { className: "is-active" }, section.label())),
          h("div", { className: "h-settings__body" }, h(Boundary, null, h(section.component))),
        )
      : null,
  );
}

function StatusBar() {
  const s = useHost();
  return h(
    "footer",
    { className: "h-status" },
    h("div", { className: "h-status__start" }, ...s.regs.status.filter((d) => d.zone === "start").map((def) => h(Boundary, { key: def.key }, h(def.component)))),
    h("div", { className: "h-status__end" }, h("span", null, "性能"), h("span", null, "·"), h("span", null, "100%"), h("span", null, "·"), h("span", null, "已同步"), h("span", null, "·"), h("span", null, "v1.1.9")),
  );
}

function App() {
  return h("div", { className: "h-app" }, h("div", { className: "h-body" }, h(Sidebar), h("main", { className: "h-main" }, h(Tabs), h(Center))), h(StatusBar));
}

const initial = params.get("view");
const command = (key) => state.regs.command.find((c) => c.key === key)?.run();
window.__command = command;
if (initial === "overview") command("open");
if (initial === "limits") command("open-limits");
if (initial === "settings") hostApi.openSettings();

window.ReactDOM.createRoot(document.getElementById("root")).render(h(App));
