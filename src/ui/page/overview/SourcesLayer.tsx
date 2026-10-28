/** 数据来源 layer: per-CLI folders, file counts, last scan, status; rescan (Loader + %, inline errors). */
import { cx } from "@ccgui/plugin-ui";
import { useEffect, useRef, type RefObject } from "react";
import type { UsageSourceStatus } from "../../../sdk-usage";
import { ago, int } from "../../../domain/format.ts";
import type { T } from "../../../i18n/index.ts";
import { useApp } from "../../app.tsx";
import { InlineAlert, Spinner } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useDismiss, useEscape, useNow } from "../../hooks.ts";
import { RescanControl } from "../../Rescan.tsx";

export function sourceStatusText(src: UsageSourceStatus, t: T, now: number, lang: "zh" | "en"): { text: string; tone: "muted" | "error" | "normal" } {
  if (src.status === "missing") return { text: t("src.missing"), tone: "muted" };
  if (src.status === "denied") return { text: t("src.denied"), tone: "error" };
  if (src.status === "error") return { text: src.error ? `${t("src.error")}：${src.error}` : t("src.error"), tone: "error" };
  const files = t("src.files", { n: int(src.files) });
  return { text: src.lastScanAt ? `${files} · ${ago(now - src.lastScanAt, lang)}` : files, tone: "normal" };
}

export function SourcesLayer({ anchorRef }: { anchorRef: RefObject<HTMLElement | null> }) {
  const app = useApp();
  const { t, lang } = app;
  const { prefs, usage } = useAll(app);
  const now = useNow(30_000);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => app.view.set((s) => (s.layer === "sources" ? { ...s, layer: null } : s));
  useDismiss([ref, anchorRef], true, close);
  useEscape(true, close);
  useEffect(() => {
    void app.usage.loadSources();
  }, [app]);

  const list = usage.sources.data ?? [];
  return (
    <div ref={ref} className="ul-layer ul-layer--sources" role="dialog" aria-label={t("src.title")}>
      <header className="ul-layer__head">
        <b>{t("src.title")}</b>
        <span>{t("src.desc")}</span>
      </header>
      {usage.sources.phase === "error" && (
        <InlineAlert className="ul-layer__alert" message={t("src.loadError", { error: usage.sources.error ?? "" })} onRetry={() => void app.usage.loadSources()} />
      )}
      {usage.sources.phase === "loading" && !list.length ? (
        <p className="ul-layer__loading">
          <Spinner />
        </p>
      ) : (
        <ul className="ul-src">
          {list.map((src) => {
            const excluded = prefs.excludedEngines.includes(src.engine);
            const st = sourceStatusText(src, t, now, lang);
            return (
              <li key={src.engine} className={cx(excluded && "is-off")}>
                <i className={cx("ul-src__dot", `is-${src.status}`)} aria-hidden="true" />
                <div className="ul-src__t">
                  <b>{src.label}</b>
                  {src.roots.map((r) => (
                    <code key={r} title={r}>
                      {r}
                    </code>
                  ))}
                  {src.env && <small>{t("src.env", { env: src.env })}</small>}
                </div>
                <span className={cx("ul-src__st", st.tone === "muted" && "ul-muted", st.tone === "error" && "ul-error-text")}>
                  {excluded ? t("src.excluded") : st.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="ul-layer__foot">
        <RescanControl hint={t("src.rescanHint")} />
      </footer>
    </div>
  );
}
