/** Limit bars and rows shared by the popover (compact) and the limits page (full). */
import { Badge, cx } from "@ccgui/plugin-ui";
import { useState, type MouseEvent } from "react";
import type { UsageLimitProvider, UsageLimitProviderId, UsageLimitWindow } from "../sdk-usage";
import { ago, durLong, durShort, pct as fmtPct, resetAt, usd, type Lang } from "../domain/format.ts";
import { barGeometry, barLevel, pace, windowInfo, type Pace } from "../domain/limits.ts";
import type { T } from "../i18n/index.ts";
import { ProviderMark } from "./ProviderMark.tsx";
import { useApp } from "./app.tsx";

/** Fixed-position hover card anchor: `above` flips it below when the row sits near the top. */
type TipPos = { left: number; top: number; above: boolean };

export const PROVIDER_NAME: Record<UsageLimitProviderId, string> = { claude: "Claude", codex: "Codex" };
export const PROVIDER_CLI: Record<UsageLimitProviderId, string> = { claude: "Claude Code", codex: "Codex" };

/** Brand tint per provider; the mark itself is drawn in the same color. */
const PROVIDER_BRAND: Record<UsageLimitProviderId, string> = { claude: "#d97757", codex: "#10a37f" };

export function ProviderLogo({ id, size = 18 }: { id: UsageLimitProviderId; size?: number }) {
  return (
    <span
      className="ul-plogo"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        ["--ul-c" as string]: PROVIDER_BRAND[id],
      }}
      aria-hidden="true"
    >
      <ProviderMark id={id} size={Math.round(size * 0.64)} />
    </span>
  );
}

export function windowLabel(w: UsageLimitWindow, t: T): string {
  const info = windowInfo(w);
  if (info.weekly && !info.model) return t("lim.weekly");
  const span = info.span ? t(info.span.unit === "h" ? "lim.hours" : "lim.days", { n: info.span.n }) : (w.label ?? w.id);
  return info.model ? t("lim.scoped", { span, model: info.model }) : span;
}

export function paceText(p: Pace, t: T, lang: Lang): string {
  switch (p.kind) {
    case "idle":
      return t("lim.paceIdle");
    case "early":
      return t("lim.paceEarly");
    case "unknown":
      return t("lim.paceUnknown");
    case "exhausted":
      return t("lim.paceExhausted");
    case "ok":
      return t("lim.paceOk", { v: fmtPct(Math.min(p.projected, 1)) });
    default:
      return t("lim.paceOver", { runOut: durLong(p.runOutMs, lang), early: durLong(p.earlyMs, lang) });
  }
}

/**
 * Hover card for a provider's rows: every window's pace + reset, what the tick
 * means, and how old the numbers are (same information as the limits page rows,
 * shown in one dark bubble instead of the OS's slow native tooltip).
 */
function LimitTip({ provider, now, pos }: { provider: UsageLimitProvider; now: number; pos: TipPos }) {
  const { t, lang } = useApp();
  return (
    <span className={cx("ul-ltip", pos.above && "is-above")} role="tooltip" style={{ left: pos.left, top: pos.top }}>
      <b className="ul-ltip__head">
        {PROVIDER_NAME[provider.id]}
        {provider.plan ? ` ${provider.plan}` : ""}
      </b>
      {provider.windows.map((w) => (
        <span key={w.id} className="ul-ltip__row">
          <span className="ul-ltip__win">{windowInfo(w).short}</span>
          <span>{paceText(pace(w, now), t, lang)}</span>
          {w.resetsAt != null && <span className="ul-ltip__reset">· {t("lim.resetAt", { at: resetAt(w.resetsAt, now, lang) })}</span>}
        </span>
      ))}
      <span className="ul-ltip__sep" />
      <span className="ul-ltip__note">{t("lim.tipNote")}</span>
      {provider.fetchedAt != null && (
        <span className="ul-ltip__foot">
          {t("lim.updated", { ago: ago(now - provider.fetchedAt, lang) })} · {resetAt(provider.fetchedAt, now, lang)}
        </span>
      )}
    </span>
  );
}

function LimitBar({ w, p, label, extraClass }: { w: UsageLimitWindow; p: Pace; label: string; extraClass?: string }) {
  const { t } = useApp();
  const g = barGeometry(w.usedPercent, p.marker);
  const level = barLevel(g.used);
  return (
    <span
      className={cx("ul-bar", `is-${level}`, extraClass)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={g.used}
      aria-label={t("lim.barAria", { label, v: g.used })}
    >
      <i className="ul-bar__fill" style={{ width: `${g.used}%` }} />
      {g.tick != null && <i className={cx("ul-bar__tick", p.kind === "over" && "is-over")} style={{ left: `${g.tick}%` }} />}
    </span>
  );
}

export function LimitRow({
  provider,
  w,
  now,
  compact,
  stale,
}: {
  provider: UsageLimitProvider;
  w: UsageLimitWindow;
  now: number;
  compact?: boolean;
  stale?: boolean;
}) {
  const { t, lang } = useApp();
  const [tip, setTip] = useState<TipPos | null>(null);
  const p = pace(w, now);
  const info = windowInfo(w);
  const label = windowLabel(w, t);
  const used = barGeometry(w.usedPercent, p.marker).used;
  const level = barLevel(used);
  const remaining = w.resetsAt == null ? null : Math.max(0, w.resetsAt - now);
  const hover = {
    onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const above = r.top > 220;
      setTip({ above, left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - 336)), top: above ? r.top - 8 : r.bottom + 8 });
    },
    onMouseLeave: () => setTip(null),
  };
  const card = tip && <LimitTip provider={provider} now={now} pos={tip} />;
  if (compact) {
    return (
      <div className={cx("ul-lrow ul-lrow--c", stale && "is-stale")} {...hover}>
        <span className="ul-lrow__lbl">{info.short}</span>
        <LimitBar w={w} p={p} label={label} />
        <span className={cx("ul-lrow__pct", `is-${level}`)}>{used}%</span>
        <span className="ul-lrow__reset">{remaining == null ? "—" : durShort(remaining)}</span>
        {card}
      </div>
    );
  }
  return (
    <div className={cx("ul-lrow", stale && "is-stale")} {...hover}>
      <span className="ul-lrow__lbl">
        {label}
        {info.model && (
          <Badge tone="neutral" className="ul-tag">
            {t("lim.modelTag")}
          </Badge>
        )}
      </span>
      <LimitBar w={w} p={p} label={label} />
      <span className={cx("ul-lrow__pct", `is-${level}`)}>
        {used}%<small>{t("common.used")}</small>
      </span>
      <span className="ul-lrow__reset">{remaining == null ? "—" : t("lim.resetIn", { dur: durLong(remaining, lang) })}</span>
      <p className={cx("ul-lrow__pace", `is-${p.kind}`)}>{paceText(p, t, lang)}</p>
      {card}
    </div>
  );
}

export function ExtraRow({ extra, stale }: { extra: { usedUsd: number; limitUsd: number }; stale?: boolean }) {
  const { t } = useApp();
  const share = extra.limitUsd > 0 ? Math.min(100, (extra.usedUsd / extra.limitUsd) * 100) : 0;
  return (
    <div className={cx("ul-lrow ul-lrow--extra", stale && "is-stale")}>
      <span className="ul-lrow__lbl">{t("lim.extra")}</span>
      <span
        className="ul-bar ul-bar--extra"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share)}
        aria-label={`${t("lim.extra")} ${usd(extra.usedUsd)} / ${usd(extra.limitUsd)}`}
      >
        <i className="ul-bar__fill" style={{ width: `${share}%` }} />
      </span>
      <span className="ul-lrow__pct">
        {usd(extra.usedUsd)}
        <small>/ {usd(extra.limitUsd)}</small>
      </span>
      <span className="ul-lrow__reset">{t("lim.extraMonth")}</span>
      <p className="ul-lrow__pace">{t("lim.extraDesc")}</p>
    </div>
  );
}
