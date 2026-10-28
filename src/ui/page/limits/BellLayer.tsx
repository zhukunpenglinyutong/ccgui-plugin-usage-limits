/**
 * Alert settings layer. Plugins cannot post system notifications yet, so
 * alerts are the status-bar tag + sidebar badge; the copy says so.
 */
import { useRef, type RefObject } from "react";
import { useApp } from "../../app.tsx";
import { Switch, ThresholdChips } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useDismiss, useEscape } from "../../hooks.ts";

export function BellLayer({ anchorRef }: { anchorRef: RefObject<HTMLElement | null> }) {
  const app = useApp();
  const { t } = app;
  const { prefs } = useAll(app);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => app.view.set((s) => (s.layer === "bell" ? { ...s, layer: null } : s));
  useDismiss([ref, anchorRef], true, close);
  useEscape(true, close);
  const setAlerts = (patch: Partial<typeof prefs.alerts>) => app.prefs.update((p) => ({ ...p, alerts: { ...p.alerts, ...patch } }));
  return (
    <div ref={ref} className="ul-layer ul-layer--bell" role="dialog" aria-label={t("bell.label")}>
      <header className="ul-layer__head ul-layer__head--row">
        <b>{t("bell.title")}</b>
        <Switch checked={prefs.alerts.on} label={t("bell.title")} onChange={(on) => setAlerts({ on })} />
      </header>
      <p className="ul-layer__p">{t("bell.desc")}</p>
      <div className="ul-layer__pad">
        <ThresholdChips value={prefs.alerts.thresholds} disabled={!prefs.alerts.on} onChange={(thresholds) => setAlerts({ thresholds })} />
      </div>
      <div className="ul-layer__row">
        <span>{t("bell.chip")}</span>
        <Switch checked={prefs.chipLimits} label={t("bell.chip")} onChange={(chipLimits) => app.prefs.update((p) => ({ ...p, chipLimits }))} />
      </div>
      <div className="ul-layer__row">
        <span>{t("bell.background")}</span>
        <Switch checked={prefs.alerts.background} label={t("bell.background")} onChange={(background) => setAlerts({ background })} />
      </div>
    </div>
  );
}
