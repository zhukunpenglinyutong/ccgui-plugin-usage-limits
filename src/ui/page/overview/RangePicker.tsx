/**
 * Custom date-range layer: presets apply and close at once; in the calendar
 * the first click picks the start, the second the end (earlier restarts),
 * then 应用. Future days are disabled; ranges over 366 days can't be applied.
 */
import { Button, cx } from "@ccgui/plugin-ui";
import { useRef, useState, type RefObject } from "react";
import { addMonths, startOfMonth, type DayKey } from "../../../domain/dates.ts";
import { dateShort, monthLabel } from "../../../domain/format.ts";
import { monthGrid, pickDraftDay, presetRange, rollingRange, validateCustomRange, type RangePreset } from "../../../domain/periods.ts";
import { applyRange } from "../../../domain/view.ts";
import { useApp } from "../../app.tsx";
import { useAll } from "../../derive.ts";
import { useDismiss, useEscape, useStore } from "../../hooks.ts";
import { Icon } from "../../icons.tsx";

const PRESETS: { id: RangePreset; key: "range.p7" | "range.p30" | "range.p90" | "range.ytd" }[] = [
  { id: "7", key: "range.p7" },
  { id: "30", key: "range.p30" },
  { id: "90", key: "range.p90" },
  { id: "ytd", key: "range.ytd" },
];

export function RangePicker({ anchorRef }: { anchorRef: RefObject<HTMLElement | null> }) {
  const app = useApp();
  const { t, raw, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const today = usage.today;
  const base = view.range ?? rollingRange(30, today);
  const [draft, setDraft] = useState<{ from: DayKey | null; to: DayKey | null }>(base);
  const [month, setMonth] = useState<DayKey>(startOfMonth(base.to));
  const layerRef = useRef<HTMLDivElement>(null);
  const close = () => app.view.set((s) => (s.layer === "range" ? { ...s, layer: null } : s));
  useDismiss([layerRef, anchorRef], true, close);
  useEscape(true, close);

  const check = validateCustomRange(draft, today);
  const weekdays = raw("range.weekdays").split(",");
  const canNext = addMonths(month, 1) <= today;
  const inDraft = (k: DayKey) => !!draft.from && !!draft.to && k >= draft.from && k <= draft.to;

  const summary = !draft.to
    ? <span className="ul-muted">{t("range.pickEnd")}</span>
    : !check.ok && check.reason === "tooLong"
      ? <span className="ul-error-text">{t("range.tooLong", { n: check.days })}</span>
      : !check.ok && check.reason === "future"
        ? <span className="ul-error-text">{t("range.future")}</span>
        : <span>{t("range.summary", { from: dateShort(draft.from as DayKey, lang), to: dateShort(draft.to, lang), n: check.days })}</span>;

  const renderMonth = (m: DayKey) => {
    const grid = monthGrid(m);
    return (
      <div className="ul-cal__m" key={m}>
        <p>{monthLabel(m, lang)}</p>
        <div className="ul-cal__g" role="grid" aria-label={monthLabel(m, lang)}>
          {weekdays.map((d) => (
            <span key={d} className="ul-cal__wd">
              {d}
            </span>
          ))}
          {Array.from({ length: grid.lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {grid.days.map((k) => (
            <button
              key={k}
              type="button"
              className={cx("ul-cal__d", inDraft(k) && "is-in", k === draft.from && "is-start", k === draft.to && "is-end", k === today && "is-today")}
              disabled={k > today}
              aria-pressed={k === draft.from || k === draft.to}
              aria-label={dateShort(k, lang)}
              onClick={() => setDraft((d) => pickDraftDay(d, k))}
            >
              {Number(k.slice(8))}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={layerRef} className="ul-layer ul-layer--range" role="dialog" aria-label={t("range.aria")}>
      <div className="ul-range">
        <div className="ul-range__presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="ul-range__p" onClick={() => app.view.set((s) => applyRange(s, presetRange(p.id, today)))}>
              {t(p.key)}
            </button>
          ))}
        </div>
        <div className="ul-range__cal">
          <div className="ul-range__nav">
            <Button variant="ghost" size="sm" className="ul-icon-btn" aria-label={t("range.prevMonth")} title={t("range.prevMonth")} onClick={() => setMonth((m) => addMonths(m, -1))}>
              <Icon name="chevL" size={14} />
            </Button>
            <Button variant="ghost" size="sm" className="ul-icon-btn" aria-label={t("range.nextMonth")} title={t("range.nextMonth")} disabled={!canNext} onClick={() => setMonth((m) => addMonths(m, 1))}>
              <Icon name="chevR" size={14} />
            </Button>
          </div>
          <div className="ul-cal">{[addMonths(month, -1), month].map(renderMonth)}</div>
        </div>
      </div>
      <footer className="ul-layer__foot ul-layer__foot--split">
        {summary}
        <span className="ul-layer__btns">
          <Button variant="ghost" size="sm" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!check.ok}
            onClick={() => {
              if (check.ok && draft.from && draft.to) {
                const range = { from: draft.from, to: draft.to };
                app.view.set((s) => applyRange(s, range));
              }
            }}
          >
            {t("common.apply")}
          </Button>
        </span>
      </footer>
    </div>
  );
}
