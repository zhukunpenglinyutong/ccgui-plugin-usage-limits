/**
 * Status-bar chip (zone "start"): today's tokens · estimated cost by default,
 * a divider, then one always-on tag per provider with its 5-hour and weekly
 * windows ("[Claude] 5h 89% 7d 37%", "[Codex] 5h 8% 7d 71%"). Tags only take
 * the warning / danger palette once a threshold is crossed — below it they
 * stay neutral, so the chip reads the same way all day. Numbers swap in place
 * (no counting animation). Clicking toggles the popover.
 */
import { cx } from "@ccgui/plugin-ui";
import { useRef } from "react";
import { tokens, usd, ago } from "../../domain/format.ts";
import { windowInfo, type ProviderTag } from "../../domain/limits.ts";
import { useApp } from "../app.tsx";
import { isEmpty, scanPct, useAll, useChipTotals, useProviderTags } from "../derive.ts";
import { useNow, useStore } from "../hooks.ts";
import { Icon } from "../icons.tsx";
import { BrandMark } from "../BrandMark.tsx";
import { Spinner } from "../controls.tsx";
import { PROVIDER_NAME, ProviderLogo } from "../limit-ui.tsx";
import { Popover } from "./Popover.tsx";

const PERIOD_KEY = { today: "chip.today", "7d": "chip.7d", month: "chip.month" } as const;

/** One provider: brand mark + its 5-hour and weekly windows side by side. */
function LimitTag({ tag }: { tag: ProviderTag }) {
  const label = tag.windows.map((x) => `${windowInfo(x.window).short} ${x.pct}%`).join(" · ");
  return (
    <span className={cx("ul-chip__lim", tag.level && `is-${tag.level}`)} title={`${PROVIDER_NAME[tag.provider]} ${label}`}>
      <ProviderLogo id={tag.provider} size={14} />
      {tag.windows.map((x, i) => (
        <span key={x.window.id} className="ul-chip__lim-pair">
          {i > 0 ? " " : null}
          <span className="ul-chip__lim-win">{windowInfo(x.window).short}</span>{" "}
          <b>{x.pct}%</b>
        </span>
      ))}
    </span>
  );
}

export function StatusChip() {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage, limits } = useAll(app);
  const view = useStore(app.view);
  const now = useNow(30_000);
  const chipRef = useRef<HTMLButtonElement>(null);
  const tags = useProviderTags(prefs, limits);
  const totals = useChipTotals(prefs, usage);
  const open = view.popover;

  const toggle = () => app.view.set((s) => ({ ...s, popover: !s.popover }));
  const close = (refocus: boolean) => {
    app.view.set((s) => (s.popover ? { ...s, popover: false } : s));
    if (refocus) chipRef.current?.focus();
  };

  const glyph = prefs.logo ? (
    <BrandMark size={14} running={usage.running && prefs.logoMotion} still={!prefs.logoMotion} />
  ) : (
    <Icon name="gauge" size={14} />
  );

  const scanning = usage.scanning && usage.phase === "ready" && !usage.firstDay;
  // Tags are on by default and do not wait for a threshold; "limit" mode is
  // nothing but the tags, so the toggle only applies to the other three modes.
  const showTags = !scanning && (prefs.chipMode === "limit" || prefs.chipLimits);
  const tagNodes = showTags ? tags.map((tag) => <LimitTag key={tag.provider} tag={tag} />) : null;

  let body;
  let title: string;
  if (scanning) {
    body = (
      <>
        <Spinner size={13} />
        <span>{t("chip.scanning", { pct: scanPct(usage) })}</span>
      </>
    );
    title = t("chip.scanningTitle");
  } else if (prefs.chipMode === "limit") {
    body = tagNodes;
    title = t("chip.click");
    if (!tags.length) {
      body = (
        <>
          {glyph}
          <span className="ul-chip__muted">{limits.phase === "loading" ? t("chip.loading") : t("chip.noLimit")}</span>
        </>
      );
    }
  } else if (isEmpty(usage)) {
    body = (
      <>
        {glyph}
        <span className="ul-chip__muted">{t("chip.empty")}</span>
        {tagNodes}
      </>
    );
    title = t("chip.emptyTitle");
  } else if (!totals) {
    body = (
      <>
        {glyph}
        <span className="ul-chip__muted">{usage.phase === "error" ? t("chip.error") : t("chip.loading")}</span>
      </>
    );
    title = usage.error ? t("common.loadError", { error: usage.error }) : t("chip.click");
  } else {
    const label = t(PERIOD_KEY[prefs.chipPeriod]);
    body = (
      <>
        {glyph}
        <span className="ul-chip__lbl">{label}</span>
        {prefs.chipMode !== "cost" && (
          <>
            <b>{tokens(totals.total)}</b>
            <span className="ul-chip__unit">{t("chip.tokens")}</span>
          </>
        )}
        {prefs.chipMode === "both" && <span className="ul-chip__sep" aria-hidden="true" />}
        {prefs.chipMode !== "tokens" && <b>{usd(totals.cost)}</b>}
        {tagNodes && <span className="ul-chip__sep" aria-hidden="true" />}
        {tagNodes}
      </>
    );
    const updated = usage.scannedAt ? ` · ${t("chip.updated", { ago: ago(now - usage.scannedAt, lang) })}` : "";
    title = `${t("chip.title", { label, tokens: tokens(totals.total), cost: usd(totals.cost) })}${updated}`;
  }

  for (const tag of tags) {
    title += `\n${PROVIDER_NAME[tag.provider]} ${tag.windows.map((x) => `${windowInfo(x.window).short} ${x.pct}%`).join(" · ")}`;
  }
  title += `\n${t("chip.click")}`;

  return (
    <span className="ul-root ul-chip-wrap">
      <button
        ref={chipRef}
        type="button"
        className={cx("ul-chip", open && "is-open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        onClick={toggle}
      >
        {body}
      </button>
      {open && <Popover anchorRef={chipRef} onClose={close} />}
    </span>
  );
}
