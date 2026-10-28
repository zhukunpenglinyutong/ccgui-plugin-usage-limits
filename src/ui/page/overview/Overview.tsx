/** Overview page: period bar, hero totals, trend + detail table, side cards. */
import { useEffect, useMemo } from "react";
import { filterRows } from "../../../domain/aggregate.ts";
import { addDays } from "../../../domain/dates.ts";
import { periodRange } from "../../../domain/periods.ts";
import { heroSummary } from "../../../domain/summary.ts";
import { useApp } from "../../app.tsx";
import { isEmpty, useAll } from "../../derive.ts";
import { useStore } from "../../hooks.ts";
import { DetailTable } from "./DetailTable.tsx";
import { Heatmap } from "./Heatmap.tsx";
import { Hero } from "./Hero.tsx";
import { PeriodBar } from "./PeriodBar.tsx";
import { EmptyState, ErrorState, LoadingState, ScanState } from "./ScanStates.tsx";
import { ModelRanking, StatsCard } from "./SideCards.tsx";
import { Trend } from "./Trend.tsx";

export function Overview() {
  const app = useApp();
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const pr = useMemo(
    () => periodRange(view.period, view.anchor, view.range, usage.today, usage.firstDay),
    [view.period, view.anchor, view.range, usage.today, usage.firstDay],
  );

  useEffect(() => {
    if (pr.gran !== "hour") return;
    app.usage.ensureHours(pr.from);
    app.usage.ensureHours(addDays(pr.from, -1));
  }, [app, pr.gran, pr.from]);

  const hero = useMemo(
    () =>
      heroSummary({
        pr,
        daily: usage.daily,
        prevDayHours: usage.hourly[addDays(pr.from, -1)] ?? null,
        today: usage.today,
        now: new Date(),
        engine: view.engine,
        excluded: prefs.excludedEngines,
      }),
    [pr, usage.daily, usage.hourly, usage.today, view.engine, prefs.excludedEngines],
  );

  const engineDaily = useMemo(
    () => filterRows(usage.daily, { excluded: prefs.excludedEngines, engine: view.engine }),
    [usage.daily, prefs.excludedEngines, view.engine],
  );
  const hourly = useMemo(
    () => filterRows(usage.hourly[pr.from] ?? [], { excluded: prefs.excludedEngines, engine: view.engine }),
    [usage.hourly, pr.from, prefs.excludedEngines, view.engine],
  );

  if (usage.phase === "loading" && !usage.daily.length) return <LoadingState />;
  if (usage.phase === "error" && !usage.daily.length) return <ErrorState />;
  if (usage.scanning && !usage.firstDay) return <ScanState />;
  if (isEmpty(usage)) return <EmptyState />;

  return (
    <div className="ul-ov">
      <PeriodBar pr={pr} />
      <Hero pr={pr} hero={hero} />
      <div className="ul-ov__grid">
        <div className="ul-ov__main">
          <Trend pr={pr} daily={engineDaily} hourly={hourly} hourlyReady={pr.gran !== "hour" || !!usage.hourly[pr.from]} />
          <DetailTable pr={pr} rows={hero.rows} daily={engineDaily} hourly={hourly} />
        </div>
        <div className="ul-ov__side">
          <StatsCard hero={hero} engineDaily={engineDaily} />
          <ModelRanking rows={hero.rows} />
          <Heatmap pr={pr} engineDaily={engineDaily} />
        </div>
      </div>
    </div>
  );
}
