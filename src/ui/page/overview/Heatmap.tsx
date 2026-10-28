/** Flat 26-week heatmap (no 3D): quantile levels, out-of-period cells dimmed, today outlined, click drills. */
import { cx } from "@ccgui/plugin-ui";
import { useMemo } from "react";
import type { UsageStatRow } from "../../../sdk-usage";
import { dateWeek, monthShort, tokens, usd } from "../../../domain/format.ts";
import { heatCells, HEATMAP_WEEKS } from "../../../domain/heatmap.ts";
import type { PeriodRange } from "../../../domain/periods.ts";
import { drill } from "../../../domain/view.ts";
import { useApp } from "../../app.tsx";
import { tipHandlers } from "../../ChartTip.tsx";
import { useAll } from "../../derive.ts";

export function Heatmap({ pr, engineDaily }: { pr: PeriodRange; engineDaily: readonly UsageStatRow[] }) {
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

  return (
    <section className="ul-card ul-heat">
      <header className="ul-card__head">
        <h3>{t("heat.title")}</h3>
        <span className="ul-card__meta">{t("heat.meta")}</span>
      </header>
      <div className="ul-heat__wrap">
        <div className="ul-heat__days" aria-hidden="true">
          {days.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="ul-heat__main">
          <div className="ul-heat__months" aria-hidden="true">
            {months.map((m, i) => (
              <span key={i} style={{ gridColumn: i + 1 }}>
                {m}
              </span>
            ))}
          </div>
          <div className="ul-heat__grid">
            {cells.map((c) => {
              // Future days and days before the first recorded use are not interactive.
              if (c.future) return <i key={c.key} className="ul-hm is-future" aria-hidden="true" />;
              if (usage.firstDay && c.key < usage.firstDay) return <i key={c.key} className="ul-hm is-before" aria-hidden="true" />;
              const label = `${dateWeek(c.key, lang)}：${c.total ? `${tokens(c.total)} tokens` : t("heat.none")}`;
              return (
                <button
                  key={c.key}
                  type="button"
                  className={cx("ul-hm", `l${c.level}`, (c.key < pr.from || c.key > pr.to) && "is-out", c.key === usage.today && "is-today")}
                  aria-label={label}
                  onClick={() => app.view.set((s) => drill(s, { kind: "day", key: c.key }, usage.today))}
                  {...tipHandlers(() => (
                    <>
                      <b>{dateWeek(c.key, lang)}</b>
                      <br />
                      {c.total ? `${tokens(c.total)} tokens · ${usd(c.cost)}` : t("heat.none")}
                    </>
                  ))}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="ul-heat__legend" aria-hidden="true">
        <span>{t("heat.less")}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`ul-hm l${l}`} />
        ))}
        <span>{t("heat.more")}</span>
        <span className="ul-heat__note">{t("heat.note")}</span>
      </div>
    </section>
  );
}
