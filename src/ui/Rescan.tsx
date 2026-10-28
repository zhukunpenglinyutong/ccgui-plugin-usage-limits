/**
 * 「重新扫描全部」: `ctx.usage.rescan()` re-reads every log still on disk and
 * keeps usage whose logs the CLIs already cleaned, so it is not destructive
 * and needs no confirmation. Progress uses Loader2 + percentage (UI spec §5),
 * not the refresh spin → check. A rejection (e.g. the host's "a full rescan
 * ran moments ago; try again in Ns" throttle) is shown inline with role=alert.
 */
import { Button } from "@ccgui/plugin-ui";
import { useApp } from "./app.tsx";
import { InlineAlert, Spinner } from "./controls.tsx";
import { scanPct, useAll } from "./derive.ts";

export function RescanControl({ hint }: { hint?: string }) {
  const app = useApp();
  const { t } = app;
  const { usage } = useAll(app);

  if (usage.rescan.running) {
    const pct = scanPct(usage);
    return (
      <div className="ul-progress-line" role="status">
        <Spinner />
        <span>{t("src.rescanning", { pct })}</span>
        <span className="ul-progress" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
    );
  }

  return (
    <div className="ul-rescan">
      <Button variant="secondary" size="sm" onClick={() => void app.usage.rescan()}>
        {t("src.rescan")}
      </Button>
      {hint && <span className="ul-hint">{hint}</span>}
      {usage.rescan.error && (
        <InlineAlert className="ul-rescan__alert" message={t("src.rescanError", { error: usage.rescan.error })} onRetry={() => void app.usage.rescan()} />
      )}
    </div>
  );
}
