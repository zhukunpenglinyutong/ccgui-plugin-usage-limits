/** Totals card: tokens, estimated cost + comparison, unpriced-model warning, engine share bar and cards. */
import { Button, cx } from "@ccgui/plugin-ui";
import { engineDef } from "../../../domain/engines.ts";
import { dateRange, dateShort, share, tokens, usd } from "../../../domain/format.ts";
import { elapsedEnd, type PeriodRange } from "../../../domain/periods.ts";
import type { CompareKind, HeroSummary } from "../../../domain/summary.ts";
import { toggleEngine } from "../../../domain/view.ts";
import type { MsgKey } from "../../../i18n/index.ts";
import { useApp } from "../../app.tsx";
import { tipHandlers } from "../../ChartTip.tsx";
import { EngineDot, InfoTip } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useStore } from "../../hooks.ts";
import { Icon } from "../../icons.tsx";

const CMP_KEY: Record<CompareKind, MsgKey> = {
  sameTime: "cmp.sameTime",
  prevDay: "cmp.prevDay",
  week: "cmp.week",
  weekToDate: "cmp.weekToDate",
  month: "cmp.month",
  monthToDate: "cmp.monthToDate",
  year: "cmp.year",
  yearToDate: "cmp.yearToDate",
  custom: "cmp.custom",
};

export function Hero({ pr, hero }: { pr: PeriodRange; hero: HeroSummary }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const view = useStore(app.view);
  const { sum } = hero;
  const end = elapsedEnd(pr, usage.today);
  const scope =
    pr.period === "custom" ? t("hero.scopeCustom") : t("hero.scopePeriod", { unit: t(`unit.${pr.period === "all" ? "year" : pr.period}` as MsgKey) });
  const pick = (id: string | null) => app.view.set((s) => toggleEngine(s, id));
  // Dismissal is remembered for this exact set of unpriced models (a new one warns again).
  const unpriced = [...sum.unknownModels].sort();
  const unpricedKey = unpriced.join(",");
  const showUnpriced = unpriced.length > 0 && unpricedKey !== prefs.ackUnpriced;

  return (
    <section className="ul-card ul-hero">
      <div className="ul-hero__top">
        <div className="ul-hero__main">
          <p className="ul-kicker">
            {t("hero.kicker")}
            {view.engine ? ` · ${engineDef(view.engine).label}` : ""}
          </p>
          <p className="ul-hero__num">{tokens(sum.total)}</p>
          <p className="ul-hero__sub">
            {t("hero.sub", {
              range: pr.from >= end ? dateShort(pr.from, lang) : dateRange(pr.from, end, lang),
              span: hero.span,
              active: hero.active,
            })}
            {hero.forecast != null && ` · ${t("hero.forecast", { scope, v: tokens(hero.forecast) })}`}
          </p>
        </div>
        <div className="ul-hero__cost">
          <p className="ul-kicker">
            {t("hero.cost")}
            <InfoTip text={t("hero.costInfo")} />
          </p>
          <p className="ul-hero__money">{usd(sum.cost)}</p>
          {hero.compare && (
            <p className="ul-delta ul-hero__delta">
              {hero.compare.delta >= 0 ? "↑" : "↓"} {Math.abs(Math.round(hero.compare.delta * 100))}%
              <span>{t(CMP_KEY[hero.compare.kind], { n: hero.compare.span })}</span>
            </p>
          )}
        </div>
      </div>

      {showUnpriced && (
        <div className="ul-warn-row">
          <Icon name="alert" size={14} />
          <span>{t("hero.unknown", { n: unpriced.length, models: unpriced.join("、"), tokens: tokens(sum.unknownTokens) })}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ul-icon-btn ul-warn-row__x"
            aria-label={t("hero.dismiss")}
            title={t("hero.dismiss")}
            onClick={() => app.prefs.update((p) => ({ ...p, ackUnpriced: unpricedKey }))}
          >
            <Icon name="x" size={14} />
          </Button>
        </div>
      )}

      {hero.shares.length > 0 && (
        <div className="ul-sharebar" role="img" aria-label={t("hero.shares")}>
          {hero.shares.map((x) => (
            <i
              key={x.id}
              className={cx(view.engine && view.engine !== x.id && "is-dim")}
              style={{ width: `${x.share * 100}%`, background: engineDef(x.id).color }}
              {...tipHandlers(() => (
                <>
                  <b>{engineDef(x.id).label}</b>
                  <br />
                  {tokens(x.total)} tokens · {share(x.share)}
                </>
              ))}
            />
          ))}
        </div>
      )}

      <div className="ul-ecards">
        <button type="button" className={cx("ul-ecard", !view.engine && "is-on")} aria-pressed={!view.engine} onClick={() => pick(null)}>
          <span className="ul-ecard__name">{t("engine.all")}</span>
          <b>100%</b>
          <span className="ul-ecard__sub">{t("engine.sub", { n: hero.modelCount, tokens: tokens(hero.sharesTotal) })}</span>
        </button>
        {hero.shares.map((x) => {
          const on = view.engine === x.id;
          const def = engineDef(x.id);
          return (
            <button
              key={x.id}
              type="button"
              className={cx("ul-ecard", on && "is-on", view.engine && !on && "is-dim")}
              aria-pressed={on}
              onClick={() => pick(x.id)}
            >
              <span className="ul-ecard__name">
                <EngineDot color={def.color} />
                {def.label}
              </span>
              <b>{share(x.share)}</b>
              <span className="ul-ecard__sub">{t("engine.sub", { n: x.models, tokens: tokens(x.total) })}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
