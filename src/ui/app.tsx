/**
 * App handle shared by every registered surface (status chip, center tab,
 * settings section). The React context is created lazily after bindReact()
 * — module-level createContext would run before the host React is bound.
 */
import { createContext, useContext, type Context, type ReactNode } from "react";
import type { LimitsService } from "../data/limits.ts";
import type { PrefsService } from "../data/prefs.ts";
import type { Store } from "../data/store.ts";
import type { UsageService } from "../data/usage.ts";
import type { Lang } from "../domain/format.ts";
import type { Page, ViewState } from "../domain/view.ts";
import type { MsgKey, T } from "../i18n/index.ts";
import type { UsageCtx } from "../sdk-usage";

export interface App {
  ctx: UsageCtx;
  lang: Lang;
  t: T;
  raw: (key: MsgKey) => string;
  version: string;
  prefs: PrefsService;
  usage: UsageService;
  limits: LimitsService;
  view: Store<ViewState>;
  openPage(page?: Page): void;
  openSettings(): void;
}

let AppContext: Context<App | null> | null = null;

export function initAppContext(): void {
  if (!AppContext) AppContext = createContext<App | null>(null);
}

export function AppProvider({ app, children }: { app: App; children: ReactNode }) {
  if (!AppContext) throw new Error("initAppContext() must run before rendering");
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

export function useApp(): App {
  const app = AppContext ? useContext(AppContext) : null;
  if (!app) throw new Error("useApp() outside <AppProvider>");
  return app;
}
