/**
 * Detail table: by time / project / model, sortable headers (aria-sort),
 * default newest first. Time rows drill in; project rows open the drawer;
 * model rows are read-only. Unpriced models show "—" instead of $0.
 */
import { cx } from "@ccgui/plugin-ui";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { UsageStatRow } from "../../../sdk-usage";
import { modelRanking, projectRanking, recentDailyAvg } from "../../../domain/aggregate.ts";
import { engineDef } from "../../../domain/engines.ts";
import { dateShort, int, share, tokens, usd } from "../../../domain/format.ts";
import type { PeriodRange } from "../../../domain/periods.ts";
import { ariaSort, sortRows, type TableKind } from "../../../domain/table.ts";
import { trendBuckets } from "../../../domain/trend.ts";
import { drill, setTable, sortBy } from "../../../domain/view.ts";
import { createProjectResolver } from "../../../domain/workspaces.ts";
import type { MsgKey } from "../../../i18n/index.ts";
import { useApp } from "../../app.tsx";
import { EngineDot, InfoTip, InlineAlert, Segmented } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useStore } from "../../hooks.ts";
import { bucketLabels } from "./Trend.tsx";

type Row = Record<string, unknown> & { id: string };
type Col = { key: string; label: MsgKey; num?: boolean };

const COLS: Record<TableKind, (gran: PeriodRange["gran"]) => Col[]> = {
  time: (gran) => [
    { key: "key", label: `col.${gran}` as MsgKey },
    { key: "total", label: "col.total", num: true },
    { key: "input", label: "col.input", num: true },
    { key: "output", label: "col.output", num: true },
    { key: "cacheRead", label: "col.cacheRead", num: true },
    { key: "cacheWrite", label: "col.cacheWrite", num: true },
    { key: "reasoning", label: "col.reasoning", num: true },
    { key: "requests", label: "col.requests", num: true },
    { key: "cost", label: "col.cost", num: true },
  ],
  project: () => [
    { key: "name", label: "col.name" },
    { key: "total", label: "col.total", num: true },
    { key: "share", label: "col.share" },
    { key: "requests", label: "col.requests", num: true },
    { key: "cost", label: "col.cost", num: true },
    { key: "last", label: "col.last" },
  ],
  model: () => [
    { key: "model", label: "col.model" },
    { key: "engine", label: "col.engine" },
    { key: "total", label: "col.total", num: true },
    { key: "input", label: "col.input", num: true },
    { key: "output", label: "col.output", num: true },
    { key: "cacheRead", label: "col.cacheRead", num: true },
    { key: "cost", label: "col.cost", num: true },
    { key: "priced", label: "col.priced" },
  ],
};

/** Cost cell: "—" when none of the tokens had a price, otherwise the (partial) estimate. */
const costCell = (r: Row): string => (Number(r.total) > 0 && Number(r.unknownTokens) >= Number(r.total) ? "—" : usd(Number(r.cost)));

export function DetailTable({
  pr,
  rows,
  daily,
  hourly,
}: {
  pr: PeriodRange;
  rows: readonly UsageStatRow[];
  daily: readonly UsageStatRow[];
  hourly: readonly UsageStatRow[];
}) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const view = useStore(app.view);
  const ref = useRef<HTMLElement>(null);
  const kind = view.table;
  const cols = COLS[kind](pr.gran);
  const sort = view.sort[kind];

  useEffect(() => {
    if (view.tableFocus > 0) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [view.tableFocus]);

  const data = useMemo<Row[]>(() => {
    if (kind === "project") {
      const resolve = createProjectResolver(usage.workspaces, t("common.otherDir"));
      return projectRanking(rows, resolve).map((p) => ({ ...p }));
    }
    if (kind === "model") return modelRanking(rows).map((m) => ({ ...m, id: m.model, engineLabel: engineDef(m.engine).label }));
    return trendBuckets({ pr, today: usage.today, nowHour: new Date().getHours(), daily, hourly, by: "engine", otherLabel: "", avg: recentDailyAvg(daily, usage.today) })
      .filter((b) => !b.future && b.total > 0)
      .map((b, i) => ({ ...b.sum, id: b.key, order: i, label: bucketLabels(b, lang).long, drillTo: b.drill }));
  }, [kind, rows, pr, usage.today, usage.workspaces, daily, hourly, lang, t]);

  const sorted = useMemo(() => sortRows(data, sort.key === "engine" ? { ...sort, key: "engineLabel" } : sort), [data, sort]);

  const cell = (r: Row, c: Col): ReactNode => {
    switch (c.key) {
      case "key":
        return r.label as string;
      case "name":
        return (
          <>
            <b className="ul-dt__name">{r.name as string}</b>
            <code className="ul-path" title={(r.path as string) ?? undefined}>
              {(r.path as string) ?? t("common.noWorkspace")}
            </code>
          </>
        );
      case "model":
        return (
          <b className="ul-mono ul-dt__model" title={r.model as string}>
            {r.model as string}
          </b>
        );
      case "engine":
        return (
          <>
            <EngineDot color={engineDef(r.engine as string).color} />
            {r.engineLabel as string}
          </>
        );
      case "share":
        return (
          <>
            <span className="ul-minibar">
              <i style={{ width: `${Number(r.share) * 100}%` }} />
            </span>
            {share(Number(r.share))}
          </>
        );
      case "requests":
        return int(Number(r.requests));
      case "cost":
        return costCell(r) === "—" ? <span className="ul-muted">—</span> : costCell(r);
      case "last":
        return r.last ? dateShort(r.last as string, lang) : "—";
      case "priced":
        return r.priced ? <span className="ul-muted">{t("col.pricedYes")}</span> : <span className="ul-warn-text">{t("col.pricedNo")}</span>;
      default:
        return tokens(Number(r[c.key]));
    }
  };

  const open = (r: Row) => {
    if (kind === "time" && r.drillTo) {
      const target = r.drillTo as Parameters<typeof drill>[1];
      app.view.set((s) => drill(s, target, usage.today));
    } else if (kind === "project") app.view.set((s) => ({ ...s, drawer: r.id }));
  };
  const clickable = kind === "project" || kind === "time";

  return (
    <section className="ul-card ul-dtable" ref={ref}>
      <header className="ul-card__head">
        <Segmented
          size="xs"
          role="tablist"
          label={t("table.aria")}
          value={kind}
          onChange={(k: TableKind) => app.view.set((s) => setTable(s, k))}
          options={[
            { value: "time", label: t(`table.tab.${pr.gran}` as MsgKey) },
            { value: "project", label: t("table.tab.project") },
            { value: "model", label: t("table.tab.model") },
          ]}
        />
        <span className="ul-card__meta">{t("table.rows", { n: sorted.length })}</span>
      </header>
      {kind === "project" && usage.workspacesError && (
        <InlineAlert className="ul-dt__alert" message={usage.workspacesError} onRetry={() => void app.usage.loadWorkspaces()} />
      )}
      <div className="ul-dt-wrap">
        <table className="ul-dt">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} aria-sort={ariaSort(sort, c.key)} className={cx(c.num && "is-num")}>
                  <button type="button" onClick={() => app.view.set((s) => sortBy(s, c.key))}>
                    {t(c.label)}
                    {c.key === "reasoning" && <InfoTip text={t("col.reasoningInfo")} />}
                    <span className="ul-sortc" aria-hidden="true">
                      {sort.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length ? (
              sorted.map((r) => (
                <tr
                  key={r.id}
                  className={cx(clickable && "is-click")}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => open(r) : undefined}
                  onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(r)) : undefined}
                >
                  {cols.map((c) => (
                    <td key={c.key} className={cx(c.num && "is-num")}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={cols.length} className="ul-dt__empty">
                  {t("table.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
