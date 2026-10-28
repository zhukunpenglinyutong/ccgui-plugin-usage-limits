/**
 * One provider card on the limits page. Collapsible (§2.4 height transition,
 * inert while collapsed; persisted). Signed-out / expired show the terminal
 * command with copy (§4.2) — the plugin never logs in or refreshes tokens.
 * Rate-limited / offline keep the last data dimmed with the age and retry.
 */
import { Badge, Button, cx } from "@ccgui/plugin-ui";
import type { ReactNode } from "react";
import type { UsageLimitProvider } from "../../../sdk-usage";
import { ago, durLong } from "../../../domain/format.ts";
import { hasWindows, isStale, isWeeklyOnly, loginCommand } from "../../../domain/limits.ts";
import { useApp } from "../../app.tsx";
import { Collapse } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { CopyButton } from "../../feedback.tsx";
import { Icon } from "../../icons.tsx";
import { ExtraRow, LimitRow, PROVIDER_CLI, PROVIDER_NAME, ProviderLogo } from "../../limit-ui.tsx";

function Banner({ tone, children, action }: { tone: "warn" | "error"; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={cx("ul-banner", `is-${tone}`)} role={tone === "error" ? "alert" : "status"}>
      <Icon name="alert" size={14} />
      <span>{children}</span>
      {action}
    </div>
  );
}

function LoginState({ p }: { p: UsageLimitProvider }) {
  const { t } = useApp();
  const cmd = loginCommand(p.id);
  const signedOut = p.status === "signedOut";
  return (
    <div className="ul-lstate">
      <p className="ul-lstate__title">{t(signedOut ? "lim.signedOutTitle" : "lim.expiredTitle", { name: PROVIDER_CLI[p.id] })}</p>
      <p className="ul-lstate__desc">{t(signedOut ? "lim.signedOutDesc" : "lim.expiredDesc")}</p>
      <div className="ul-cmd">
        <Icon name="term" size={14} />
        <code>{cmd}</code>
        <CopyButton text={cmd} />
      </div>
    </div>
  );
}

export function ProviderBody({ p, now }: { p: UsageLimitProvider; now: number }) {
  const app = useApp();
  const { t, lang } = app;
  const { limits } = useAll(app);
  if (p.status === "signedOut" || p.status === "expired") return <LoginState p={p} />;
  const retrying = !!limits.retrying[p.id];
  const retry = (
    <Button size="sm" variant="secondary" disabled={retrying} aria-busy={retrying || undefined} onClick={() => void app.limits.retry(p.id).catch(() => undefined)}>
      {retrying ? t("common.retrying") : t("common.retry")}
    </Button>
  );
  const age = p.fetchedAt == null ? null : ago(now - p.fetchedAt, lang);
  const withData = hasWindows(p);
  let banner = null;
  if (p.status === "rateLimited") {
    banner = (
      <Banner tone="warn">
        {p.retryAt != null && p.retryAt > now
          ? t("lim.rateLimited", { ago: age ?? "—", retry: durLong(p.retryAt - now, lang) })
          : t("lim.rateLimitedNoRetry", { ago: age ?? "—" })}
      </Banner>
    );
  } else if (p.status === "offline") {
    banner = (
      <Banner tone="error" action={retry}>
        {withData && age ? t("lim.offline", { host: p.host, ago: age }) : t("lim.offlineNoData", { host: p.host })}
      </Banner>
    );
  } else if (p.status === "error") {
    banner = (
      <Banner tone="error" action={retry}>
        {t("lim.error", { error: p.error ?? "" })}
      </Banner>
    );
  }
  const stale = isStale(p);
  return (
    <>
      {banner}
      {withData && (
        <div className="ul-pcard__rows">
          {p.windows.map((w) => (
            <LimitRow key={w.id} provider={p} w={w} now={now} stale={stale} />
          ))}
          {p.extra && <ExtraRow extra={p.extra} stale={stale} />}
        </div>
      )}
      {p.id === "codex" && withData && isWeeklyOnly(p) && (
        <p className="ul-pcard__note">{p.plan ? t("lim.weeklyOnly", { plan: p.plan }) : t("lim.weeklyOnlyNoPlan")}</p>
      )}
    </>
  );
}

export function ProviderCard({ p, now }: { p: UsageLimitProvider; now: number }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs } = useAll(app);
  const collapsed = !!prefs.collapsed[p.id];
  const bodyId = `ul-prov-${p.id}`;
  const meta = p.fetchedAt != null ? t("lim.updated", { ago: ago(now - p.fetchedAt, lang) }) : "";
  return (
    <section className={cx("ul-pcard-lg", collapsed && "is-collapsed")}>
      <button
        type="button"
        className="ul-pcard-lg__head"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={() => app.prefs.update((pr) => ({ ...pr, collapsed: { ...pr.collapsed, [p.id]: !collapsed } }))}
      >
        <ProviderLogo id={p.id} size={22} />
        <b>{PROVIDER_NAME[p.id]}</b>
        {p.plan && <Badge tone="neutral">{p.plan}</Badge>}
        <span className="ul-pcard-lg__meta">{meta}</span>
        <Icon name="chevD" className="ul-pcard-lg__chev" />
      </button>
      <Collapse open={!collapsed} id={bodyId}>
        <div className="ul-pcard-lg__body">
          <ProviderBody p={p} now={now} />
        </div>
      </Collapse>
    </section>
  );
}

/** Placeholder card while the first read is in flight. */
export function ProviderSkeleton({ id }: { id: "claude" | "codex" }) {
  const { t } = useApp();
  return (
    <section className="ul-pcard-lg" aria-busy="true">
      <div className="ul-pcard-lg__head is-static">
        <ProviderLogo id={id} size={22} />
        <b>{PROVIDER_NAME[id]}</b>
        <span className="ul-pcard-lg__meta">{t("lim.loading")}</span>
      </div>
      <div className="ul-pcard-lg__body" aria-hidden="true">
        <span className="ul-skel ul-skel--lrow" />
        <span className="ul-skel ul-skel--lrow" />
      </div>
    </section>
  );
}
