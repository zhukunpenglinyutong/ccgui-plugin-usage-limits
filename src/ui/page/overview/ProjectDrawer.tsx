/**
 * Project drawer (right side of the usage tab). Esc or the scrim closes it.
 * The design's 「在侧栏定位工作区」 is intentionally absent: the SDK has no API
 * to reveal or highlight a sidebar workspace row, and the plugin does not
 * render buttons that cannot work.
 */
import { Button } from "@ccgui/plugin-ui";
import { useEffect, useMemo, useRef } from "react";
import { engineShares, filterRows, modelRanking, sumRows } from "../../../domain/aggregate.ts";
import { engineDef } from "../../../domain/engines.ts";
import { dateWeek, int, tokens, usd } from "../../../domain/format.ts";
import { elapsedEnd, periodRange } from "../../../domain/periods.ts";
import { lastDays } from "../../../domain/summary.ts";
import { createProjectResolver } from "../../../domain/workspaces.ts";
import { useApp } from "../../app.tsx";
import { tipHandlers } from "../../ChartTip.tsx";
import { EngineDot } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useEscape, useStore } from "../../hooks.ts";
import { Icon } from "../../icons.tsx";
import { periodLabel } from "./PeriodBar.tsx";

export function ProjectDrawer({ projectId }: { projectId: string }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => app.view.set((s) => ({ ...s, drawer: null }));
  useEscape(true, close);
  useEffect(() => closeRef.current?.focus(), []);

  const data = useMemo(() => {
    const resolve = createProjectResolver(usage.workspaces, t("common.otherDir"));
    const pr = periodRange(view.period, view.anchor, view.range, usage.today, usage.firstDay);
    const mine = filterRows(usage.daily, { excluded: prefs.excludedEngines, engine: view.engine }).filter((r) => resolve(r.project).id === projectId);
    const inPeriod = filterRows(mine, { from: pr.from, to: elapsedEnd(pr, usage.today) });
    const ref = resolve(mine[0]?.project ?? null);
    return {
      pr,
      ref: mine.length ? ref : { id: projectId, name: projectId, path: null },
      sum: sumRows(inPeriod),
      engines: engineShares(inPeriod),
      models: modelRanking(inPeriod),
      days: lastDays(mine, usage.today),
    };
  }, [usage.workspaces, usage.daily, usage.today, usage.firstDay, view, prefs.excludedEngines, projectId, t]);

  const dmax = Math.max(1, ...data.days.map((d) => d.total));
  return (
    <>
      <div className="ul-scrim" onClick={close} aria-hidden="true" />
      <aside className="ul-drawer" role="dialog" aria-modal="false" aria-label={t("drawer.aria", { name: data.ref.name })}>
        <header className="ul-drawer__head">
          <div>
            <h3>{data.ref.name}</h3>
            <code className="ul-path" title={data.ref.path ?? undefined}>
              {data.ref.path ?? t("common.noWorkspace")}
            </code>
          </div>
          <Button ref={closeRef} variant="ghost" className="ul-icon-btn" aria-label={t("common.close")} title={t("common.close")} onClick={close}>
            <Icon name="x" />
          </Button>
        </header>
        <p className="ul-kicker">
          {periodLabel(data.pr, usage.today, usage.firstDay, t, lang)}
          {view.engine ? ` · ${engineDef(view.engine).label}` : ""}
        </p>
        <div className="ul-drawer__nums">
          <div>
            <span>{t("drawer.total")}</span>
            <b>{tokens(data.sum.total)}</b>
          </div>
          <div>
            <span>{t("drawer.cost")}</span>
            <b>{usd(data.sum.cost)}</b>
          </div>
          <div>
            <span>{t("drawer.requests")}</span>
            <b>{int(data.sum.requests)}</b>
          </div>
        </div>
        <p className="ul-kicker">{t("drawer.byEngine")}</p>
        <div className="ul-sharebar ul-sharebar--sm" aria-hidden="true">
          {data.engines.map((e) => (
            <i key={e.id} style={{ width: `${e.share * 100}%`, background: engineDef(e.id).color }} />
          ))}
        </div>
        <ul className="ul-kv">
          {data.engines.map((e) => (
            <li key={e.id}>
              <EngineDot color={engineDef(e.id).color} />
              {engineDef(e.id).label}
              <b>{tokens(e.total)}</b>
            </li>
          ))}
        </ul>
        <p className="ul-kicker">{t("drawer.byModel")}</p>
        <ul className="ul-kv">
          {data.models.length ? (
            data.models.map((m) => (
              <li key={m.model}>
                <span className="ul-mono ul-kv__name" title={m.model}>
                  {m.model}
                </span>
                <b>{tokens(m.total)}</b>
              </li>
            ))
          ) : (
            <li className="ul-muted">{t("common.noData")}</li>
          )}
        </ul>
        <p className="ul-kicker">{t("drawer.last30")}</p>
        <div className="ul-mini">
          {data.days.map((d) => (
            <i
              key={d.key}
              tabIndex={0}
              aria-label={`${dateWeek(d.key, lang)} ${tokens(d.total)} tokens`}
              style={{ height: `${Math.max(2, (d.total / dmax) * 100)}%` }}
              {...tipHandlers(() => (
                <>
                  {dateWeek(d.key, lang)}
                  <br />
                  {tokens(d.total)} tokens
                </>
              ))}
            />
          ))}
        </div>
      </aside>
    </>
  );
}
