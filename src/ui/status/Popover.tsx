/**
 * Status-bar popover. The status bar may clip overflow, so the panel is
 * `position: fixed`, computed from the chip's rect: opens upward, left
 * aligned, re-positioned on resize. Closes on outside pointer-down, Esc
 * (focus returns to the chip) or a second chip click.
 */
import { Button } from "@ccgui/plugin-ui";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ago, int } from "../../domain/format.ts";
import { addDays } from "../../domain/dates.ts";
import { enabledProviders } from "../../domain/prefs.ts";
import { useApp } from "../app.tsx";
import { InlineAlert } from "../controls.tsx";
import { anyProviderFailed, isEmpty, scanPct, useAlert, useAll } from "../derive.ts";
import { RefreshButton, useRunningFeedback } from "../feedback.tsx";
import { useDismiss, useEscape, useNow } from "../hooks.ts";
import { Icon } from "../icons.tsx";
import { BrandMark } from "../BrandMark.tsx";
import { PopoverLimits, PopoverStats, PopoverState, SayBubble, usePopoverSummary } from "./PopoverParts.tsx";

const WIDTH = 400;
const AUTO_REFRESH_AFTER_MS = 60_000;

type Pos = { left: number; bottom: number; width: number; maxHeight: number };

function computePos(anchor: HTMLElement | null): Pos | null {
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 16);
  const left = Math.min(Math.max(8, r.left - 4), window.innerWidth - width - 8);
  return { left, bottom: window.innerHeight - r.top + 6, width, maxHeight: Math.max(160, r.top - 16) };
}

export function Popover({ anchorRef, onClose }: { anchorRef: RefObject<HTMLButtonElement | null>; onClose: (refocus: boolean) => void }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage, limits } = useAll(app);
  const now = useNow(30_000);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(() => computePos(anchorRef.current));
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
      app.usage.refresh().catch(() => undefined);
    }
    app.usage.ensureHours(addDays(s.today, -1));
    return () => app.limits.setVisible("popover", false);
  }, [app]);

  useDismiss([popRef, anchorRef], true, () => onClose(false));
  useEscape(true, () => onClose(true));

  const go = (page: "overview" | "limits") => {
    onClose(false);
    app.openPage(page);
  };

  const scanning = usage.scanning && !usage.firstDay;
  const hasProviders = enabledProviders(prefs).length > 0;
  const refreshAll = async () => {
    await Promise.all([app.usage.refresh(), hasProviders ? app.limits.fetch(true) : Promise.resolve()]);
    // §4.1: no check mark when any enabled provider failed to refresh.
    if (anyProviderFailed(app.limits.store.get())) throw new Error("limits refresh failed");
  };

  return (
    <div
      ref={popRef}
      className="ul-root ul-pop"
      role="dialog"
      aria-label={t("pop.label")}
      tabIndex={-1}
      style={pos ? { left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight } : { visibility: "hidden" }}
    >
      <header className="ul-pop__head">
        {prefs.logo ? (
          <BrandMark size={26} running={usage.running && prefs.logoMotion} still={!prefs.logoMotion} />
        ) : (
          <Icon name="gauge" size={24} className="ul-pop__glyph" />
        )}
        <div className="ul-pop__say">
          <SayBubble usage={usage} alert={alert} s={summary} />
          <span className="ul-pop__ago">
            {usage.scannedAt ? t("pop.updated", { ago: ago(now - usage.scannedAt, lang) }) : t("pop.never")}
          </span>
        </div>
        <RefreshButton onRefresh={refreshAll} feedback={autoFeedback} />
        <Button
          variant="ghost"
          className="ul-icon-btn"
          aria-label={t("common.settings")}
          title={t("common.settings")}
          onClick={() => {
            onClose(false);
            app.openSettings();
          }}
        >
          <Icon name="sliders" />
        </Button>
      </header>

      {usage.refreshError && usage.phase === "ready" && (
        <InlineAlert
          className="ul-pop__alert"
          message={t("common.refreshError", { error: usage.refreshError })}
          retrying={usage.refreshing}
          onRetry={() => void app.usage.refresh().catch(() => undefined)}
        />
      )}

      {usage.phase === "error" ? (
        <InlineAlert className="ul-pop__alert" message={t("common.loadError", { error: usage.error ?? "" })} onRetry={() => void app.usage.reload()} />
      ) : scanning ? (
        <PopoverState spinning title={t("pop.scanningTitle", { pct: scanPct(usage) })} body={t("pop.scanningBody", { done: int(usage.progress?.done ?? 0), total: int(usage.progress?.total ?? 0) })} />
      ) : isEmpty(usage) ? (
        <PopoverState title={t("pop.emptyTitle")} body={t("pop.emptyBody")} />
      ) : usage.phase === "loading" ? (
        <div className="ul-pop__skel" aria-hidden="true">
          <span className="ul-skel ul-skel--today" />
          <span className="ul-skel ul-skel--cards" />
        </div>
      ) : (
        <PopoverStats s={summary} />
      )}

      {hasProviders && <PopoverLimits now={now} />}

      <footer className="ul-pop__foot">
        <Button variant="ghost" size="sm" className="ul-linkbtn" onClick={() => go("overview")}>
          {t("pop.overview")}
          <Icon name="arrowR" size={13} />
        </Button>
        <Button variant="ghost" size="sm" className="ul-linkbtn" onClick={() => go("limits")}>
          {t("pop.limits")}
          <Icon name="arrowR" size={13} />
        </Button>
      </footer>
    </div>
  );
}
