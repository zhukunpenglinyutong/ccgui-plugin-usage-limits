/**
 * Center tab "用量" with two inner pages (概览 / 限额). Switching pages never
 * opens another tab. Limits auto-refresh only runs while this tab is really
 * visible (host keeps inactive center tabs mounted with visibility: hidden).
 */
import { Badge, Button, cx } from "@ccgui/plugin-ui";
import { useEffect, useRef } from "react";
import { setPage, toggleLayer } from "../../domain/view.ts";
import { useApp } from "../app.tsx";
import { ChartTip, hideTip } from "../ChartTip.tsx";
import { Segmented } from "../controls.tsx";
import { anyProviderFailed, useAlert, useAll } from "../derive.ts";
import { RefreshButton } from "../feedback.tsx";
import { useElementVisible, useStore } from "../hooks.ts";
import { Icon } from "../icons.tsx";
import { BellLayer } from "./limits/BellLayer.tsx";
import { LimitsPage } from "./limits/LimitsPage.tsx";
import { Overview } from "./overview/Overview.tsx";
import { ProjectDrawer } from "./overview/ProjectDrawer.tsx";
import { SourcesLayer } from "./overview/SourcesLayer.tsx";

function PageHeader() {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const view = useStore(app.view);
  const alert = useAlert(prefs, limits);
  const isLimits = view.page === "limits";
  const anchorRef = useRef<HTMLDivElement>(null);

  const refreshLimits = async () => {
    await app.limits.fetch(true);
    if (anyProviderFailed(app.limits.store.get())) throw new Error("limits refresh failed");
  };

  return (
    <header className="ul-phead">
      <div className="ul-phead__l">
        <h2>{t("page.title")}</h2>
        <Segmented
          role="tablist"
          className="ul-itabs"
          label={t("page.tabs")}
          value={view.page}
          onChange={(page) => app.view.set((s) => setPage(s, page))}
          options={[
            { value: "overview", label: t("page.overview") },
            {
              value: "limits",
              label: t("page.limits"),
              badge: alert?.level ? (
                <Badge tone={alert.level === "danger" ? "error" : "neutral"} className={cx("ul-alert-badge", `is-${alert.level}`)}>
                  {alert.pct}%
                </Badge>
              ) : null,
            },
          ]}
        />
      </div>
      <div className="ul-phead__r" ref={anchorRef}>
        {isLimits ? (
          <>
            <RefreshButton onRefresh={refreshLimits} />
            <Button
              variant="ghost"
              className={cx("ul-icon-btn", view.layer === "bell" && "is-on")}
              aria-label={t("bell.label")}
              title={t("bell.label")}
              aria-expanded={view.layer === "bell"}
              aria-haspopup="dialog"
              data-layer-anchor="bell"
              onClick={() => app.view.set((s) => toggleLayer(s, "bell"))}
            >
              <Icon name={prefs.alerts.on ? "bell" : "bellOff"} />
            </Button>
            <Button variant="ghost" className="ul-icon-btn" aria-label={t("common.settings")} title={t("common.settings")} onClick={() => app.openSettings()}>
              <Icon name="sliders" />
            </Button>
            {view.layer === "bell" && <BellLayer anchorRef={anchorRef} />}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              className={cx(view.layer === "sources" && "is-on")}
              aria-expanded={view.layer === "sources"}
              aria-haspopup="dialog"
              data-layer-anchor="sources"
              onClick={() => app.view.set((s) => toggleLayer(s, "sources"))}
            >
              <Icon name="db" size={14} />
              {t("page.sources")}
            </Button>
            <RefreshButton onRefresh={() => app.usage.reload().then(() => {
              const err = app.usage.store.get().error;
              if (err) throw new Error(err);
            })} />
            {view.layer === "sources" && <SourcesLayer anchorRef={anchorRef} />}
          </>
        )}
      </div>
    </header>
  );
}

export function UsagePage() {
  const app = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={rootRef} className="ul-root ul-page">
      <div className="ul-page__scroll" onScroll={hideTip}>
        <div className="ul-page__in">
          <PageHeader />
          {view.page === "overview" ? <Overview /> : <LimitsPage />}
        </div>
      </div>
      {view.page === "overview" && view.drawer && <ProjectDrawer projectId={view.drawer} />}
      <ChartTip />
    </div>
  );
}
