/** Loading / error / first-scan / empty states of the overview (UI spec §5). */
import { cx } from "@ccgui/plugin-ui";
import { useEffect } from "react";
import { ENGINES, engineDef } from "../../../domain/engines.ts";
import { int } from "../../../domain/format.ts";
import { useApp } from "../../app.tsx";
import { InlineAlert, Spinner } from "../../controls.tsx";
import { scanPct, useAll } from "../../derive.ts";
import { Icon } from "../../icons.tsx";
import { BrandMark } from "../../BrandMark.tsx";

export function LoadingState() {
  return (
    <div className="ul-ov" aria-busy="true">
      <div className="ul-skel-grid" aria-hidden="true">
        <span className="ul-skel ul-skel--bar" />
        <span className="ul-skel ul-skel--hero" />
        <span className="ul-skel ul-skel--card" />
        <span className="ul-skel ul-skel--card" />
      </div>
    </div>
  );
}

export function ErrorState() {
  const app = useApp();
  const { usage } = useAll(app);
  return (
    <div className="ul-ov">
      <section className="ul-card ul-empty">
        <h3>{app.t("error.title")}</h3>
        <InlineAlert message={usage.error ?? ""} onRetry={() => void app.usage.reload()} />
      </section>
    </div>
  );
}

export function ScanState() {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  const pct = scanPct(usage);
  const current = usage.progress?.engine ?? null;
  const seen = usage.progressEngines;
  useEffect(() => {
    if (usage.sources.phase === "idle") void app.usage.loadSources();
  }, [app, usage.sources.phase]);
  const ids = usage.sources.data?.filter((s) => s.status === "ok").map((s) => s.engine) ?? ENGINES.map((e) => e.id);
  return (
    <div className="ul-ov">
      <section className="ul-card ul-scan" role="status">
        <div className="ul-scan__head">
          <Spinner size={16} />
          <b>{t("scan.title")}</b>
          <span className="ul-scan__pct">{pct}%</span>
        </div>
        <span className="ul-progress" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
        <p>{t("scan.body", { done: int(usage.progress?.done ?? 0), total: int(usage.progress?.total ?? 0) })}</p>
        <ul className="ul-scan__list">
          {ids.map((id) => {
            const state = id === current ? "run" : seen.includes(id) ? "done" : "wait";
            const src = usage.sources.data?.find((s) => s.engine === id);
            return (
              <li key={id} className={cx(`is-${state}`)}>
                {state === "done" ? <Icon name="check" size={14} /> : state === "run" ? <Spinner /> : <i aria-hidden="true" />}
                <b>{src?.label ?? engineDef(id).label}</b>
                <span>
                  {state === "wait" ? t("scan.waiting") : state === "run" ? t("scan.running") : src ? t("scan.files", { n: int(src.files) }) : t("scan.done")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="ul-skel-grid" aria-hidden="true">
        <span className="ul-skel ul-skel--hero" />
        <span className="ul-skel ul-skel--card" />
        <span className="ul-skel ul-skel--card" />
      </div>
    </div>
  );
}

export function EmptyState() {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);
  useEffect(() => {
    if (usage.sources.phase === "idle") void app.usage.loadSources();
  }, [app, usage.sources.phase]);
  const dirs = usage.sources.data
    ? usage.sources.data.flatMap((s) => s.roots.map((root) => ({ key: `${s.engine}:${root}`, name: s.label, dir: root })))
    : ENGINES.map((e) => ({ key: e.id, name: e.label, dir: e.dir }));
  return (
    <div className="ul-ov">
      <section className="ul-card ul-empty">
        <BrandMark size={44} still />
        <h3>{t("empty.title")}</h3>
        <p>{t("pop.emptyBody")}</p>
        {usage.sources.phase === "error" && <InlineAlert message={t("src.loadError", { error: usage.sources.error ?? "" })} onRetry={() => void app.usage.loadSources()} />}
        <details className="ul-empty__dirs">
          <summary>{t("empty.dirs", { n: dirs.length })}</summary>
          <ul>
            {dirs.map((d) => (
              <li key={d.key}>
                <b>{d.name}</b>
                <code>{d.dir}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
