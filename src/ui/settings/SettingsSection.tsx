/**
 * Plugin settings (registerSettingsSection → 设置 ›「插件」分组). Every option
 * applies immediately and persists through ctx.storage.
 */
import { Select } from "@ccgui/plugin-ui";
import { useEffect } from "react";
import type { AutoRefresh, ChipMode, ChipPeriod, Prefs } from "../../domain/prefs.ts";
import { useApp } from "../app.tsx";
import { InlineAlert, Switch, ThresholdChips } from "../controls.tsx";
import { useAll } from "../derive.ts";
import { DataCards } from "./SettingsData.tsx";
import { Card, Row } from "./layout.tsx";

export function SettingsSection() {
  const app = useApp();
  const { t } = app;
  const { prefs, prefsState } = useAll(app);
  const set = (fn: (p: Prefs) => Prefs) => app.prefs.update(fn);

  useEffect(() => {
    void app.usage.loadSources();
    void app.usage.loadPrices();
    void app.usage.maybeAutoUpdatePrices(app.prefs.get().priceAuto);
  }, [app]);

  return (
    <div className="ul-root ul-settings">
      <header className="ul-set__head">
        <h2>{t("plugin.name")}</h2>
        <p>{t("set.head", { version: app.version })}</p>
      </header>
      {prefsState.saveError && <InlineAlert message={t("set.saveError", { error: prefsState.saveError })} onRetry={() => void app.prefs.flush()} />}

      <Card title={t("set.status")}>
        <Row label={t("set.chipMode")} htmlFor="ul-chip-mode">
          <Select id="ul-chip-mode" value={prefs.chipMode} onChange={(e) => set((p) => ({ ...p, chipMode: e.target.value as ChipMode }))}>
            <option value="both">{t("set.mode.both")}</option>
            <option value="tokens">{t("set.mode.tokens")}</option>
            <option value="cost">{t("set.mode.cost")}</option>
            <option value="limit">{t("set.mode.limit")}</option>
          </Select>
        </Row>
        <Row label={t("set.chipPeriod")} htmlFor="ul-chip-period">
          <Select
            id="ul-chip-period"
            value={prefs.chipPeriod}
            disabled={prefs.chipMode === "limit"}
            onChange={(e) => set((p) => ({ ...p, chipPeriod: e.target.value as ChipPeriod }))}
          >
            <option value="today">{t("set.period.today")}</option>
            <option value="7d">{t("set.period.7d")}</option>
            <option value="month">{t("set.period.month")}</option>
          </Select>
        </Row>
        <Row label={t("set.logo")} desc={t("set.logoDesc")}>
          <Switch checked={prefs.logo} label={t("set.logo")} onChange={(logo) => set((p) => ({ ...p, logo }))} />
        </Row>
        <Row label={t("set.motion")} desc={t("set.motionDesc")}>
          <Switch
            checked={prefs.logoMotion}
            disabled={!prefs.logo}
            label={t("set.motion")}
            onChange={(logoMotion) => set((p) => ({ ...p, logoMotion }))}
          />
        </Row>
        <Row label={t("set.chipLimits")} desc={t("set.chipLimitsDesc")}>
          <Switch checked={prefs.chipLimits} label={t("set.chipLimits")} onChange={(chipLimits) => set((p) => ({ ...p, chipLimits }))} />
        </Row>
      </Card>

      <Card title={t("set.limits")}>
        <Row label={t("set.autoRefresh")} desc={t("set.autoRefreshDesc")} htmlFor="ul-auto-refresh">
          <Select id="ul-auto-refresh" value={prefs.autoRefresh} onChange={(e) => set((p) => ({ ...p, autoRefresh: e.target.value as AutoRefresh }))}>
            {(["5", "10", "15", "30"] as const).map((n) => (
              <option key={n} value={n}>
                {t("set.every", { n })}
              </option>
            ))}
            <option value="off">{t("set.off")}</option>
          </Select>
        </Row>
        <Row label={t("set.claude")} desc={t("set.claudeDesc")}>
          <Switch
            checked={prefs.providers.claude}
            label={t("set.claude")}
            onChange={(claude) => set((p) => ({ ...p, providers: { ...p.providers, claude } }))}
          />
        </Row>
        <Row label={t("set.codex")} desc={t("set.codexDesc")}>
          <Switch checked={prefs.providers.codex} label={t("set.codex")} onChange={(codex) => set((p) => ({ ...p, providers: { ...p.providers, codex } }))} />
        </Row>
        <Row label={t("set.alerts")} desc={t("set.alertsDesc")}>
          <div className="ul-srow__stack">
            <Switch checked={prefs.alerts.on} label={t("set.alerts")} onChange={(on) => set((p) => ({ ...p, alerts: { ...p.alerts, on } }))} />
            <ThresholdChips
              value={prefs.alerts.thresholds}
              disabled={!prefs.alerts.on}
              onChange={(thresholds) => set((p) => ({ ...p, alerts: { ...p.alerts, thresholds } }))}
            />
          </div>
        </Row>
        <Row label={t("set.background")} desc={t("set.backgroundDesc")}>
          <Switch
            checked={prefs.alerts.background}
            label={t("set.background")}
            onChange={(background) => set((p) => ({ ...p, alerts: { ...p.alerts, background } }))}
          />
        </Row>
      </Card>

      <DataCards />
    </div>
  );
}
