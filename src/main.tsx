/**
 * usage-limits · Tier-1 entry. Binds the host React first, then wires the
 * data services and registers: status-bar chip (zone "start"), sidebar nav
 * (badge only while a limit window is at an alert threshold), one center tab
 * with 概览 / 限额 pages, the settings section and ⌘K commands.
 */
import type { ComponentType } from "react";
import type { PluginContext } from "./ccgui-plugin";
import type { UsageCtx } from "./sdk-usage";
import { bindReact } from "./shim/react.ts";
import { createLimitsService, type LimitsConfig } from "./data/limits.ts";
import { createPrefs } from "./data/prefs.ts";
import { createStore } from "./data/store.ts";
import { createUsageService } from "./data/usage.ts";
import { todayKey } from "./domain/dates.ts";
import { autoRefreshMs, enabledProviders, type Prefs } from "./domain/prefs.ts";
import { initialView, setPage, type Page } from "./domain/view.ts";
import { createT, langOf } from "./i18n/index.ts";
import { AppProvider, initAppContext, type App } from "./ui/app.tsx";
import { computeAlert } from "./ui/derive.ts";
import { GaugeIcon } from "./ui/icons.tsx";
import { UsagePage } from "./ui/page/UsagePage.tsx";
import { SettingsSection } from "./ui/settings/SettingsSection.tsx";
import { StatusChip } from "./ui/status/StatusChip.tsx";

const TAB_KEY = "usage";
const SETTINGS_KEY = "settings";

/**
 * The status-bar tags are a limits surface: while they are on screen the
 * service keeps polling, which is what stops the chip from freezing until the
 * popover is clicked. Hidden tags fall back to the popover / limits page.
 */
const chipShowsLimits = (p: Prefs): boolean =>
  enabledProviders(p).length > 0 && (p.chipMode === "limit" || p.chipLimits);

const limitsConfig = (p: Prefs): LimitsConfig => ({
  enabled: enabledProviders(p),
  visibleMs: autoRefreshMs(p.autoRefresh),
  background: p.alerts.background,
});

function createApp(ctx: UsageCtx): App {
  const lang = langOf(ctx.host?.locale);
  const { t, raw } = createT(lang);
  const prefs = createPrefs(ctx.storage);
  const view = createStore(initialView(todayKey(Date.now())));
  const usage = createUsageService({
    ctx,
    chipScope: () => ({ period: prefs.get().chipPeriod, excluded: prefs.get().excludedEngines }),
  });
  const limits = createLimitsService({ ctx, config: limitsConfig(prefs.get()) });
  const openPage = (page?: Page) => {
    if (page) view.set((s) => setPage(s, page));
    view.set((s) => (s.popover ? { ...s, popover: false } : s));
    try {
      ctx.ui.openCenterTab(TAB_KEY);
    } catch {
      // The tab is registered in activate; if the host still refuses, land on settings rather than doing nothing.
      ctx.ui.openSettings(SETTINGS_KEY);
    }
  };
  const openSettings = () => {
    view.set((s) => (s.popover ? { ...s, popover: false } : s));
    ctx.ui.openSettings(SETTINGS_KEY);
  };
  return { ctx, lang, t, raw, version: ctx.version, prefs, usage, limits, view, openPage, openSettings };
}

function registerSurfaces(app: App): () => void {
  const { ctx, t } = app;
  const wrap = (Inner: ComponentType) =>
    function Surface() {
      return (
        <AppProvider app={app}>
          <Inner />
        </AppProvider>
      );
    };
  const disposers: (() => void)[] = [];
  disposers.push(ctx.ui.registerStatusBarItem({ key: "chip", zone: "start", order: 10, component: wrap(StatusChip) }));
  disposers.push(ctx.ui.registerCenterTab({ key: TAB_KEY, title: () => t("tab.title"), icon: GaugeIcon, component: wrap(UsagePage) }));
  disposers.push(ctx.ui.registerSettingsSection({ key: SETTINGS_KEY, label: () => t("plugin.name"), icon: GaugeIcon, component: wrap(SettingsSection) }));
  disposers.push(
    ctx.ui.registerCommand({ key: "open", title: () => t("cmd.open"), keywords: () => ["usage", "token", "cost", "用量", "费用"], run: () => app.openPage("overview") }),
  );
  disposers.push(
    ctx.ui.registerCommand({ key: "open-limits", title: () => t("cmd.openLimits"), keywords: () => ["limit", "quota", "限额", "claude", "codex"], run: () => app.openPage("limits") }),
  );
  disposers.push(
    ctx.ui.registerCommand({ key: "refresh", title: () => t("cmd.refresh"), keywords: () => ["usage", "refresh", "刷新"], run: () => void app.usage.refresh().catch(() => undefined) }),
  );
  // A reported chunk or a finished turn is when quota actually moves: refresh
  // the windows then (floored at a minute inside the service) instead of
  // letting the chip wait for the next interval tick.
  disposers.push(ctx.events.on("usage://updated", () => app.limits.poke()));
  disposers.push(ctx.events.on("usage://done", () => app.limits.poke()));

  // Sidebar badge = highest window % while at an alert threshold. The host
  // evaluates badge() on render; re-registering the same key refreshes it.
  let badge: string | null = null;
  let navDispose: (() => void) | null = null;
  const registerNav = () => {
    navDispose?.();
    navDispose = ctx.ui.registerSidebarNav({
      key: "nav",
      label: () => t("nav.label"),
      icon: GaugeIcon,
      order: 20,
      badge: () => badge,
      onOpen: () => app.openPage(),
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

function watchPrefs(app: App): () => void {
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

export default function activate(rawCtx: PluginContext): () => void {
  bindReact(rawCtx.react);
  initAppContext();
  const ctx = rawCtx as UsageCtx;
  const app = createApp(ctx);
  const unregister = registerSurfaces(app);
  const unwatch = watchPrefs(app);
  let disposed = false;
  app.usage.init();
  void app.prefs.load().then(() => {
    if (disposed) return;
    app.limits.configure(limitsConfig(app.prefs.get()));
    // Host-cached limits (no network refresh) so the alert tag / badge show at startup.
    app.limits.fetch(false).catch(() => undefined);
    // Registered after the cached read so its (higher-sequence) refresh is the
    // result that lands; the chip is on screen from launch, so it polls.
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
