/** Side column: stat tiles and the model ranking (top 5 + §2.4 expand). */
import { Button } from "@ccgui/plugin-ui";
import { useMemo, type ReactNode } from "react";
import type { UsageStatRow } from "../../../sdk-usage";
import { activeDays, modelRanking, type ModelStat } from "../../../domain/aggregate.ts";
import { assignModelColors, OTHER_COLOR } from "../../../domain/engines.ts";
import { int, share, tokens } from "../../../domain/format.ts";
import type { HeroSummary } from "../../../domain/summary.ts";
import { useApp } from "../../app.tsx";
import { Collapse, EngineDot } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useStore } from "../../hooks.ts";
import { Icon } from "../../icons.tsx";

export function StatsCard({ hero, engineDaily }: { hero: HeroSummary; engineDaily: readonly UsageStatRow[] }) {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  const totalActive = useMemo(() => activeDays(engineDaily), [engineDaily]);
  const tile = (label: string, value: ReactNode, sub?: string) => (
    <div className="ul-stile">
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
  return (
    <section className="ul-card ul-stats">
      <div className="ul-stiles">
        {tile(t("stats.avg"), tokens(hero.active ? hero.sum.total / hero.active : 0), t("stats.avgNote"))}
        {tile(
          t("stats.activeDays"),
          <>
            {hero.active}
            <em>/ {hero.span}</em>
          </>,
        )}
        {tile(t("stats.requests"), int(hero.sum.requests), t("stats.requestsNote"))}
        {tile(t("stats.sessions"), int(hero.sum.sessions))}
      </div>
      <p className="ul-stats__foot">
        <span>{usage.firstDay ? t("stats.first", { date: usage.firstDay }) : ""}</span>
        <span>{t("stats.total", { n: totalActive })}</span>
      </p>
    </section>
  );
}

function ModelItem({ m, rank, color }: { m: ModelStat; rank: number; color: string }) {
  return (
    <li>
      <span className="ul-rank">{rank}</span>
      <span className="ul-mname" title={m.model}>
        <EngineDot color={color} />
        <span className="ul-mono">{m.model}</span>
      </span>
      <b>{share(m.share)}</b>
      <span className="ul-mbar">
        <i style={{ width: `${m.share * 100}%`, background: color }} />
      </span>
    </li>
  );
}

export function ModelRanking({ rows }: { rows: readonly UsageStatRow[] }) {
  const app = useApp();
  const { t } = app;
  const view = useStore(app.view);
  const list = useMemo(() => modelRanking(rows), [rows]);
  const colors = useMemo(() => assignModelColors(list.map((m) => m.model)), [list]);
  const top = list.slice(0, 5);
  const rest = list.slice(5);
  const open = view.modelsOpen;
  const item = (m: ModelStat, rank: number) => (
    <ModelItem key={m.model} m={m} rank={rank} color={colors.get(m.model) ?? OTHER_COLOR} />
  );
  return (
    <section className="ul-card ul-models">
      <header className="ul-card__head">
        <h3>{t("models.title")}</h3>
        <span className="ul-card__meta">{t("models.meta")}</span>
      </header>
      {list.length ? (
        <>
          <ol className="ul-mlist">
            {top.map((m, i) => item(m, i + 1))}
          </ol>
          {rest.length > 0 && (
            <>
              <Collapse open={open} id="ul-models-more">
                <ol className="ul-mlist ul-mlist--more" start={6}>
                  {rest.map((m, i) => item(m, i + 6))}
                </ol>
              </Collapse>
              <Button
                variant="ghost"
                size="sm"
                className="ul-linkbtn ul-models__more"
                aria-expanded={open}
                aria-controls="ul-models-more"
                onClick={() => app.view.set((s) => ({ ...s, modelsOpen: !s.modelsOpen }))}
              >
                {open ? t("models.less") : t("models.more", { n: list.length })}
                <Icon name="chevD" size={13} className={open ? "ul-flip" : undefined} />
              </Button>
            </>
          )}
        </>
      ) : (
        <p className="ul-card__empty">{t("common.noData")}</p>
      )}
    </section>
  );
}
