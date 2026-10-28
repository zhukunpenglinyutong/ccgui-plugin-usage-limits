/** Popover sections: brand mark bubble text, period cards, compact limit rows. */
import { Badge, cx } from "@ccgui/plugin-ui";
import { useEffect, useMemo, useState } from "react";
import type { UsageLimitProvider } from "../../sdk-usage";
import { addDays } from "../../domain/dates.ts";
import { ago, dateShort, rate, tokens, usd } from "../../domain/format.ts";
import { hasWindows, isStale, loginCommand, windowInfo, type LimitAlert } from "../../domain/limits.ts";
import { enabledProviders } from "../../domain/prefs.ts";
import { popoverSummary, type PopoverSummary } from "../../domain/summary.ts";
import { cacheHitRate, type Totals } from "../../domain/aggregate.ts";
import type { UsageState } from "../../data/usage.ts";
import { templateParts } from "../../i18n/index.ts";
import { useApp } from "../app.tsx";
import { Spinner } from "../controls.tsx";
import { useAll } from "../derive.ts";
import { LimitRow, PROVIDER_NAME, ProviderLogo } from "../limit-ui.tsx";

/** Popover cards pick a scope; nothing navigates — the detail opens right here. */
type PopoverTarget = "day" | "7d" | "30d" | "all";

export function usePopoverSummary(): PopoverSummary {
  const { prefs, usage } = useAll(useApp());
  return useMemo(
    () =>
      popoverSummary({
        daily: usage.daily,
        todayHours: usage.hourly[usage.today] ?? [],
        yesterdayHours: usage.hourly[addDays(usage.today, -1)] ?? null,
        today: usage.today,
        now: new Date(),
        excluded: prefs.excludedEngines,
      }),
    [usage.daily, usage.hourly, usage.today, prefs.excludedEngines],
  );
}

const SAY_MODES = ["delta", "alert", "tokens", "cost"] as const;
type SayMode = (typeof SAY_MODES)[number];
/** Auto-switch cadence; a manual click restarts the timer. */
const SAY_INTERVAL_MS = 5000;
const SAY_ORDER = {
  hot: ["alert", "tokens", "cost"],
  cold: ["delta", "tokens", "cost"],
} as const satisfies Record<"hot" | "cold", readonly SayMode[]>;

function nextSay(mode: SayMode | null, hot: boolean): SayMode {
  const order: readonly SayMode[] = hot ? SAY_ORDER.hot : SAY_ORDER.cold;
  const i = mode == null ? -1 : order.indexOf(mode);
  // No stored mode, or one from the other order (the alert just appeared or
  // cleared): the first item is what's on screen, so step past it.
  return order[i < 0 ? 1 : (i + 1) % order.length] ?? order[0];
}

/**
 * Header bubble: cycles (alert or vs yesterday → today's tokens → today's cost)
 * on a 5 s timer and on click. The alert leads when a window is hot.
 */
export function SayBubble({ usage, alert, s }: { usage: UsageState; alert: LimitAlert | null; s: PopoverSummary }) {
  const { t } = useApp();
  const [mode, setMode] = useState<SayMode | null>(null);
  const [manual, setManual] = useState(0);
  const hot = !!alert?.level;
  useEffect(() => {
    const id = setInterval(() => setMode((m) => nextSay(m, hot)), SAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hot, manual]);

  let fixed: string | null = null;
  if (usage.scanning && !usage.firstDay) fixed = t("say.scanning");
  else if (usage.phase === "error") fixed = t("say.error");
  else if (usage.phase === "ready" && !usage.firstDay) fixed = t("say.empty");
  if (fixed) return <span className="ul-say">{fixed}</span>;

  let deltaText = t("say.started");
  if (s.delta != null) {
    const pct = Math.round(Math.abs(s.delta) * 100);
    deltaText = pct < 3 ? t("say.same") : t(s.delta > 0 ? "say.more" : "say.less", { pct });
  }
  const texts: Record<SayMode, string> = {
    delta: deltaText,
    alert: alert?.level ? t("say.alert", { provider: PROVIDER_NAME[alert.provider], window: windowInfo(alert.window).short }) : "",
    tokens: t("say.todayTokens", { tokens: tokens(s.today.total) }),
    cost: t("say.todayCost", { cost: usd(s.today.cost) }),
  };
  const order: readonly SayMode[] = hot ? SAY_ORDER.hot : SAY_ORDER.cold;
  const active = mode != null && order.includes(mode) ? mode : order[0];
  return (
    <button
      type="button"
      className="ul-say ul-say--cycle"
      title={t("say.cycle")}
      onClick={() => {
        setMode((m) => nextSay(m, hot));
        setManual((n) => n + 1);
      }}
    >
      {texts[active]}
    </button>
  );
}

export function PopoverState({ title, body, spinning }: { title: string; body: string; spinning?: boolean }) {
  return (
    <div className="ul-pop__state">
      {spinning && <Spinner size={16} />}
      <div>
        <b>{title}</b>
        <p>{body}</p>
      </div>
    </div>
  );
}

export function PopoverStats({ s }: { s: PopoverSummary }) {
  const app = useApp();
  const { t, lang } = app;
  const { usage } = useAll(app);
  const [sel, setSel] = useState<PopoverTarget | null>(null);
  const hmax = Math.max(1, ...s.hours);
  const hit = (x: Totals) => {
    const v = cacheHitRate(x);
    return v == null ? "—" : rate(v);
  };
  const split = (x: Totals) =>
    t("pop.split", {
      input: tokens(x.input),
      output: tokens(x.output),
      cacheRead: tokens(x.cacheRead),
      cacheWrite: tokens(x.cacheWrite),
      hit: hit(x),
    });
  const card = (label: string, sum: Totals, sub: string, target: PopoverTarget) => (
    <button
      type="button"
      className={cx("ul-pcard", sel === target && "is-on")}
      title={split(sum)}
      aria-expanded={sel === target}
      onClick={() => setSel((cur) => (cur === target ? null : target))}
    >
      <span className="ul-pcard__lbl">{label}</span>
      <b>{tokens(sum.total)}</b>
      <span className="ul-pcard__cost">{usd(sum.cost)}</span>
      <span className="ul-pcard__sub">{sub}</span>
    </button>
  );
  const picked = sel === "day" ? s.today : sel === "7d" ? s.last7 : sel === "30d" ? s.last30 : sel === "all" ? s.all : null;
  return (
    <>
      <button
        type="button"
        className={cx("ul-ptoday", sel === "day" && "is-on")}
        title={split(s.today)}
        aria-expanded={sel === "day"}
        onClick={() => setSel((cur) => (cur === "day" ? null : "day"))}
      >
        <span className="ul-ptoday__l">
          <span className="ul-ptoday__lbl">{t("chip.today")}</span>
          <b className="ul-ptoday__num">{tokens(s.today.total)}</b>
          <span className="ul-ptoday__meta">
            <span>{usd(s.today.cost)}</span>
            {s.delta != null && (
              <span className="ul-delta">
                {s.delta >= 0 ? "↑" : "↓"} {Math.abs(Math.round(s.delta * 100))}%<span>{t("pop.vsYesterday")}</span>
              </span>
            )}
          </span>
        </span>
        <span className="ul-spark" aria-hidden="true">
          {s.hours.map((h, i) => (
            <i key={i} className={cx(i > s.nowHour && "is-future")} style={{ height: `${Math.max(4, (h / hmax) * 100)}%` }} />
          ))}
        </span>
      </button>
      <div className="ul-pcards">
        {card(t("pop.last7"), s.last7, t("pop.activeDays", { n: s.active7 }), "7d")}
        {card(t("pop.last30"), s.last30, t("pop.dailyAvg", { v: tokens(s.last30.total / 30) }), "30d")}
        {card(t("pop.all"), s.all, usage.firstDay ? t("pop.since", { date: dateShort(usage.firstDay, lang) }) : "", "all")}
      </div>
      {picked && (
        <div className="ul-pdetail" role="region" aria-label={t("pop.splitTitle")}>
          {(
            [
              ["col.input", tokens(picked.input)],
              ["col.output", tokens(picked.output)],
              ["col.cacheRead", tokens(picked.cacheRead)],
              ["col.cacheWrite", tokens(picked.cacheWrite)],
              ["col.cacheHit", hit(picked)],
            ] as const
          ).map(([key, v]) => (
            <span key={key}>
              <i>{t(key)}</i>
              <b>{v}</b>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function ProviderLine({ text, cmd, error }: { text: string; cmd?: string; error?: boolean }) {
  return (
    <p className={cx("ul-pprov__state", error && "is-error")} role={error ? "alert" : undefined}>
      {templateParts(text).map((part, i) => (part.key === "cmd" && cmd ? <code key={i}>{cmd}</code> : <span key={i}>{part.text}</span>))}
    </p>
  );
}

function PopoverProvider({ p, now }: { p: UsageLimitProvider; now: number }) {
  const { t, raw, lang } = useApp();
  const stale = isStale(p);
  let body;
  if (p.status === "signedOut") body = <ProviderLine text={raw("lim.signedOutLine")} cmd={loginCommand(p.id)} />;
  else if (p.status === "expired") body = <ProviderLine text={raw("lim.expiredLine")} cmd={loginCommand(p.id)} />;
  else if (p.status === "error" && !hasWindows(p)) body = <ProviderLine error text={t("lim.errorLine", { error: p.error ?? "" })} />;
  else {
    body = (
      <>
        {p.windows.map((w) => (
          <LimitRow key={w.id} provider={p} w={w} now={now} compact stale={stale} />
        ))}
        {p.status === "rateLimited" && <ProviderLine text={t("lim.rateLimitedLine")} />}
        {p.status === "offline" && <ProviderLine error text={t("lim.offlineLine", { host: p.host })} />}
        {p.status === "error" && <ProviderLine error text={t("lim.errorLine", { error: p.error ?? "" })} />}
      </>
    );
  }
  return (
    <div className="ul-pprov">
      <div className="ul-pprov__head">
        <ProviderLogo id={p.id} />
        <b>{PROVIDER_NAME[p.id]}</b>
        {p.plan && <Badge tone="neutral">{p.plan}</Badge>}
        {stale && p.fetchedAt != null && <span className="ul-pprov__ago">{t("lim.dataAgo", { ago: ago(now - p.fetchedAt, lang) })}</span>}
      </div>
      {body}
    </div>
  );
}

export function PopoverLimits({ now }: { now: number }) {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const enabled = enabledProviders(prefs);
  const providers = limits.providers.filter((p) => enabled.includes(p.id));
  return (
    <section className="ul-plim" aria-label={t("common.limits")}>
      <header className="ul-plim__head">
        <span>{t("common.limits")}</span>
      </header>
      {limits.phase === "error" && !providers.length ? (
        <p className="ul-pprov__state is-error" role="alert">
          {t("lim.loadError", { error: limits.error ?? "" })}
        </p>
      ) : limits.phase === "loading" || limits.phase === "idle" ? (
        <div aria-hidden="true">
          <span className="ul-skel ul-skel--row" />
          <span className="ul-skel ul-skel--row" />
        </div>
      ) : (
        providers.map((p) => <PopoverProvider key={p.id} p={p} now={now} />)
      )}
    </section>
  );
}

/** Short status text used by the limit alert in titles. */
export function alertShort(alert: LimitAlert): string {
  return `${PROVIDER_NAME[alert.provider]} ${windowInfo(alert.window).short} ${alert.pct}%`;
}
