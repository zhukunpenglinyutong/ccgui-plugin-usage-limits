/** Period tabs, ‹ › navigation, "back to today", engine filter chip, custom range layer. */
import { Button } from "@ccgui/plugin-ui";
import { useRef } from "react";
import { daysBetween } from "../../../domain/dates.ts";
import { engineDef } from "../../../domain/engines.ts";
import { dateRange, dateShort, dateWeek, monthLabel, yearLabel, type Lang } from "../../../domain/format.ts";
import { canShift, type Period, type PeriodRange } from "../../../domain/periods.ts";
import { goToday, setPeriod, shift, toggleEngine, toggleLayer } from "../../../domain/view.ts";
import type { MsgKey, T } from "../../../i18n/index.ts";
import { useApp } from "../../app.tsx";
import { EngineDot, Segmented } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useStore } from "../../hooks.ts";
import { Icon } from "../../icons.tsx";
import { RangePicker } from "./RangePicker.tsx";

const PERIODS: Period[] = ["day", "week", "month", "year", "all", "custom"];

export function periodLabel(pr: PeriodRange, today: string, firstDay: string | null, t: T, lang: Lang): string {
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

export function PeriodBar({ pr }: { pr: PeriodRange }) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const tabsRef = useRef<HTMLDivElement>(null);
  const today = usage.today;
  const unit = pr.period === "day" || pr.period === "week" || pr.period === "month" || pr.period === "year" ? pr.period : null;

  const choose = (p: Period) => {
    if (p === "custom") app.view.set((s) => toggleLayer(s, "range"));
    else app.view.set((s) => setPeriod(s, p, today));
  };

  return (
    <div className="ul-pbar">
      <div className="ul-pbar__tabs" ref={tabsRef}>
        <Segmented
          role="tablist"
          label={t("period.aria")}
          value={view.period}
          onChange={choose}
          options={PERIODS.map((p) => ({
            value: p,
            label: t(`period.${p}` as MsgKey),
            icon: p === "custom" ? ("cal" as const) : undefined,
          }))}
        />
        {view.layer === "range" && <RangePicker anchorRef={tabsRef} />}
      </div>
      <div className="ul-pnav">
        {unit ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="ul-icon-btn"
              aria-label={t("nav.prev", { unit: t(`unit.${unit}` as MsgKey) })}
              title={t("nav.prev", { unit: t(`unit.${unit}` as MsgKey) })}
              disabled={!canShift(pr.period, view.anchor, -1, today, usage.firstDay)}
              onClick={() => app.view.set((s) => shift(s, -1))}
            >
              <Icon name="chevL" size={14} />
            </Button>
            <span className="ul-pnav__lbl">{periodLabel(pr, today, usage.firstDay, t, lang)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ul-icon-btn"
              aria-label={t("nav.next", { unit: t(`unit.${unit}` as MsgKey) })}
              title={t("nav.next", { unit: t(`unit.${unit}` as MsgKey) })}
              disabled={!canShift(pr.period, view.anchor, 1, today, usage.firstDay)}
              onClick={() => app.view.set((s) => shift(s, 1))}
            >
              <Icon name="chevR" size={14} />
            </Button>
            {!pr.containsToday && (
              <Button variant="secondary" size="sm" onClick={() => app.view.set((s) => goToday(s, today))}>
                {t(`nav.back.${unit}` as MsgKey)}
              </Button>
            )}
          </>
        ) : (
          <>
            <span className="ul-pnav__lbl">{periodLabel(pr, today, usage.firstDay, t, lang)}</span>
            {pr.period === "custom" && <span className="ul-pnav__muted">{t("nav.days", { n: daysBetween(pr.from, pr.to) + 1 })}</span>}
          </>
        )}
      </div>
      {view.engine && (
        <span className="ul-fchip">
          <EngineDot color={engineDef(view.engine).color} />
          {t("filter.only", { name: engineDef(view.engine).label })}
          <button type="button" aria-label={t("filter.clear")} title={t("filter.clear")} onClick={() => app.view.set((s) => toggleEngine(s, null))}>
            <Icon name="x" size={12} />
          </button>
        </span>
      )}
    </div>
  );
}
