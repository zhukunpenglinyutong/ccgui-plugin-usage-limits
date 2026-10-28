/** Settings cards: data sources (+ rescan with progress), price table, privacy & credits. */
import { Button, cx } from "@ccgui/plugin-ui";
import { stamp } from "../../domain/format.ts";
import { toggleInList } from "../../domain/prefs.ts";
import { templateParts } from "../../i18n/index.ts";
import { useApp } from "../app.tsx";
import { InlineAlert, Spinner, Switch } from "../controls.tsx";
import { useAll } from "../derive.ts";
import { CopyButton, FeedbackIcon, useActionFeedback } from "../feedback.tsx";
import { useNow } from "../hooks.ts";
import { sourceStatusText } from "../page/overview/SourcesLayer.tsx";
import { RescanControl } from "../Rescan.tsx";
import { Card, Row } from "./layout.tsx";

export const TOKENTRACKER_URL = "https://github.com/xiufengsun/tokentracker";
export const NOTICES_URL = "https://github.com/zhukunpenglinyutong/ccgui-plugin-usage-limits/blob/main/THIRD_PARTY_NOTICES.md";

function SourcesCard() {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const now = useNow(30_000);
  const list = usage.sources.data ?? [];
  return (
    <Card title={t("set.sources")}>
      {usage.sources.phase === "error" && (
        <InlineAlert className="ul-scard__alert" message={t("src.loadError", { error: usage.sources.error ?? "" })} onRetry={() => void app.usage.loadSources()} />
      )}
      {usage.sources.phase === "loading" && !list.length && (
        <p className="ul-scard__loading">
          <Spinner />
        </p>
      )}
      {list.length > 0 && (
        <div className="ul-srclist">
          {list.map((src) => {
            const included = !prefs.excludedEngines.includes(src.engine);
            const st = sourceStatusText(src, t, now, lang);
            return (
              <div key={src.engine} className={cx("ul-srcrow", !included && "is-off")}>
                <i className={cx("ul-src__dot", `is-${src.status}`)} aria-hidden="true" />
                <b>{src.label}</b>
                <code title={src.roots.join("\n")}>{src.roots[0] ?? ""}</code>
                <span className={cx("ul-srcrow__st", st.tone === "muted" && "ul-muted", st.tone === "error" && "ul-error-text")}>{st.text}</span>
                <Switch
                  checked={included}
                  label={t("set.include", { name: src.label })}
                  onChange={() => app.prefs.update((p) => ({ ...p, excludedEngines: toggleInList(p.excludedEngines, src.engine) }))}
                />
              </div>
            );
          })}
          <p className="ul-srclist__note">{t("set.excludeNote")}</p>
        </div>
      )}
      <Row label={t("set.rescan")} desc={t("set.rescanDesc")}>
        <RescanControl />
      </Row>
    </Card>
  );
}

function PricesCard() {
  const app = useApp();
  const { t } = app;
  const { prefs, usage } = useAll(app);
  const update = useActionFeedback();
  const info = usage.prices.data;
  const desc = info
    ? `${t(info.source === "online" ? "set.priceOnline" : "set.priceBundled", { date: info.snapshotDate, n: info.models.toLocaleString("en-US") })}${
        info.updatedAt ? ` · ${t("set.priceUpdatedAt", { at: stamp(info.updatedAt) })}` : ""
      }`
    : usage.prices.phase === "loading"
      ? "…"
      : "";
  return (
    <Card title={t("set.prices")}>
      {usage.prices.phase === "error" && (
        <InlineAlert className="ul-scard__alert" message={t("set.priceError", { error: usage.prices.error ?? "" })} onRetry={() => void app.usage.loadPrices()} />
      )}
      <Row label={t("set.priceTable")} desc={desc}>
        <Button
          variant="secondary"
          size="sm"
          disabled={update.feedback === "running" || usage.priceUpdate.running}
          aria-busy={update.feedback === "running" || undefined}
          onClick={() => void update.run(() => app.usage.updatePrices(true))}
        >
          <FeedbackIcon icon="refresh" feedback={update.feedback} size={13} />
          {t("set.updateNow")}
        </Button>
      </Row>
      {usage.priceUpdate.error && <InlineAlert className="ul-scard__alert" message={t("set.priceUpdateError", { error: usage.priceUpdate.error })} />}
      <Row
        label={t("set.priceAuto")}
        desc={
          <>
            {t("set.priceAutoDesc")}
            {usage.priceUpdate.lastError && (
              <span className="ul-error-text ul-block" role="alert">
                {t("set.priceLastError", { error: usage.priceUpdate.lastError })}
              </span>
            )}
          </>
        }
      >
        <Switch checked={prefs.priceAuto} label={t("set.priceAuto")} onChange={(priceAuto) => app.prefs.update((p) => ({ ...p, priceAuto }))} />
      </Row>
      <Row label={t("set.noPrice")} desc={t("set.noPriceDesc")}>
        {usage.unknownModels.length ? (
          <span className="ul-chips">
            {usage.unknownModels.map((m) => (
              <code key={m} className="ul-mono ul-chip-code" title={m}>
                {m}
              </code>
            ))}
          </span>
        ) : (
          <span className="ul-muted">{t("set.noPriceNone")}</span>
        )}
      </Row>
    </Card>
  );
}

function PrivacyCard() {
  const app = useApp();
  const { t, raw } = app;
  const link = (label: string, url: string, showUrl: boolean) => (
    <span className="ul-credit" title={url}>
      <b>{label}</b>
      {showUrl && <code className="ul-credit__url">{url.replace(/^https:\/\//, "")}</code>}
      <CopyButton text={url} label={t("common.copyLink")} copiedLabel={t("common.linkCopied")} />
    </span>
  );
  return (
    <Card title={t("set.privacy")}>
      <p className="ul-sp">{t("set.privacy1")}</p>
      <p className="ul-sp">{t("set.privacy2")}</p>
      <p className="ul-sp">
        {templateParts(raw("set.privacy3")).map((part, i) =>
          part.key === "tokentracker" ? (
            <span key={i}>{link("TokenTracker", TOKENTRACKER_URL, true)}</span>
          ) : part.key === "notices" ? (
            <span key={i}>{link("THIRD_PARTY_NOTICES.md", NOTICES_URL, false)}</span>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>
    </Card>
  );
}

export function DataCards() {
  return (
    <>
      <SourcesCard />
      <PricesCard />
      <PrivacyCard />
    </>
  );
}
