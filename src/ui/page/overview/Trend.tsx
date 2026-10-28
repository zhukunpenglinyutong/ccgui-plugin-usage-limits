/**
 * Stacked trend bars (by engine or by model). Hover / focus shows the
 * split; click drills into that day / week / month; ← → move between bars
 * and Enter drills. Future days in the current period show a dashed
 * forecast box (average of the last 7 active days).
 */
import { cx } from "@ccgui/plugin-ui";
import { useMemo, type KeyboardEvent } from "react";
import type { UsageStatRow } from "../../../sdk-usage";
import { recentDailyAvg } from "../../../domain/aggregate.ts";
import { dateRange, dateShort, dateWeek, hourRange, monthLabel, monthShort, tokens, usd, type Lang } from "../../../domain/format.ts";
import type { PeriodRange } from "../../../domain/periods.ts";
import { niceCeil, trendBuckets, type TrendBucket, type TrendBy } from "../../../domain/trend.ts";
import { drill } from "../../../domain/view.ts";
import { useApp } from "../../app.tsx";
import { tipHandlers } from "../../ChartTip.tsx";
import { Segmented } from "../../controls.tsx";
import { useAll } from "../../derive.ts";

export function bucketLabels(b: TrendBucket, lang: Lang): { short: string; long: string } {
  if (b.hour != null) return { short: String(b.hour), long: `${dateShort(b.from, lang)} ${hourRange(b.hour)}` };
  if (b.gran === "day") return { short: String(Number(b.from.slice(8))), long: dateWeek(b.from, lang) };
  if (b.gran === "week") return { short: `${Number(b.from.slice(5, 7))}/${Number(b.from.slice(8))}`, long: dateRange(b.from, b.to, lang) };
  return { short: monthShort(b.from, lang), long: monthLabel(b.from, lang) };
}

function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const cols = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(".ul-tcol:not(.is-static)") ?? [])];
  const i = cols.indexOf(event.currentTarget);
  const next = cols[i + (event.key === "ArrowLeft" ? -1 : 1)];
  if (next) next.focus();
  event.preventDefault();
}

export function Trend({
  pr,
  daily,
  hourly,
  hourlyReady,
}: {
  pr: PeriodRange;
  daily: readonly UsageStatRow[];
  hourly: readonly UsageStatRow[];
  hourlyReady: boolean;
}) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const by = prefs.trendBy;
  const buckets = useMemo(
    () =>
      trendBuckets({
        pr,
        today: usage.today,
        nowHour: new Date().getHours(),
        daily,
        hourly,
        by,
        otherLabel: t("trend.other"),
        avg: recentDailyAvg(daily, usage.today),
      }),
    [pr, usage.today, daily, hourly, by, t],
  );
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.total, b.forecast)));
  const top = niceCeil(max);
  const every = buckets.length > 16 ? Math.ceil(buckets.length / 8) : 1;
  const legend = new Map<string, { name: string; color: string }>();
  for (const b of buckets) for (const p of b.parts) if (p.v > 0) legend.set(p.key, { name: p.name, color: p.color });
  const hasForecast = buckets.some((b) => b.forecast > 0);

  const tip = (b: TrendBucket, long: string) => {
    if (b.forecast) {
      return (
        <>
          <b>{long}</b>
          <br />
          {t("trend.tipForecast", { v: tokens(b.forecast) })}
          <br />
          <small>{t("trend.tipForecastNote")}</small>
        </>
      );
    }
    if (b.future) return <><b>{long}</b><br />{t("trend.tipFuture")}</>;
    const parts = b.parts.filter((p) => p.v > 0).sort((x, y) => y.v - x.v);
    return (
      <>
        <b>{long}</b>
        <br />
        {tokens(b.total)} tokens · {usd(b.sum.cost)}
        {parts.length > 0 && (
          <ul className="ul-tip__list">
            {parts.map((p) => (
              <li key={p.key}>
                <i style={{ background: p.color }} />
                <span className="ul-tip__name">{p.name}</span>
                <b>{tokens(p.v)}</b>
              </li>
            ))}
          </ul>
        )}
        {b.drill && <small>{t("trend.tipDrill")}</small>}
      </>
    );
  };

  return (
    <section className="ul-card ul-trend">
      <header className="ul-card__head">
        <h3>{t("trend.title")}</h3>
        <Segmented
          size="xs"
          label={t("trend.by")}
          value={by}
          onChange={(v: TrendBy) => app.prefs.update((p) => ({ ...p, trendBy: v }))}
          options={[
            { value: "engine", label: t("trend.byEngine") },
            { value: "model", label: t("trend.byModel") },
          ]}
        />
        <div className="ul-legend">
          {[...legend.entries()].map(([key, l]) => (
            <span key={key} title={l.name}>
              <i style={{ background: l.color }} />
              <span className="ul-legend__name">{l.name}</span>
            </span>
          ))}
          {hasForecast && (
            <span>
              <i className="ul-legend__fc" />
              {t("trend.forecast")}
            </span>
          )}
        </div>
      </header>
      <div className={cx("ul-tchart", !hourlyReady && "is-loading")} aria-busy={!hourlyReady || undefined}>
        <div className="ul-tgrid" aria-hidden="true">
          {[1 / 3, 2 / 3, 1].map((f) => (
            <span key={f} className="ul-tgrid__line" style={{ bottom: `${f * 100}%` }}>
              <em>{tokens(top * f)}</em>
            </span>
          ))}
        </div>
        <div className="ul-tcols" role="group" aria-label={t("trend.aria")}>
          {buckets.map((b, i) => {
            const { short, long } = bucketLabels(b, lang);
            const clickable = !!b.drill && !b.future;
            return (
              <button
                key={b.key}
                type="button"
                className={cx("ul-tcol", b.isNow && "is-now", b.future && "is-future", !clickable && "is-static")}
                tabIndex={clickable ? 0 : -1}
                aria-disabled={!clickable || undefined}
                aria-label={b.future ? t("trend.barFuture", { label: long }) : t("trend.barAria", { label: long, v: tokens(b.total) })}
                onClick={() => {
                  const target = b.drill;
                  if (clickable && target) app.view.set((s) => drill(s, target, usage.today));
                }}
                onKeyDown={moveFocus}
                {...tipHandlers(() => tip(b, long))}
              >
                {b.forecast > 0 && <span className="ul-tcol__fc" style={{ height: `${(b.forecast / top) * 100}%` }} />}
                <span className="ul-tcol__stack" style={{ height: `${(b.total / top) * 100}%` }}>
                  {b.parts
                    .filter((p) => p.v > 0)
                    .map((p) => (
                      <i key={p.key} style={{ height: `${(p.v / b.total) * 100}%`, background: p.color }} />
                    ))}
                </span>
                <span className="ul-tcol__x">{i % every === 0 ? short : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
