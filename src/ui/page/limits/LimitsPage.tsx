/** 限额 page: intro, provider cards, hidden-provider note, no-provider empty state. */
import { Button } from "@ccgui/plugin-ui";
import { enabledProviders, PROVIDER_IDS } from "../../../domain/prefs.ts";
import { useApp } from "../../app.tsx";
import { InlineAlert } from "../../controls.tsx";
import { useAll } from "../../derive.ts";
import { useNow } from "../../hooks.ts";
import { PROVIDER_NAME } from "../../limit-ui.tsx";
import { ProviderCard, ProviderSkeleton } from "./ProviderCard.tsx";

export function LimitsPage() {
  const app = useApp();
  const { t } = app;
  const { prefs, limits } = useAll(app);
  const now = useNow(30_000);
  const enabled = enabledProviders(prefs);
  const hidden = PROVIDER_IDS.filter((id) => !prefs.providers[id]).map((id) => PROVIDER_NAME[id]);
  const loading = limits.phase === "idle" || limits.phase === "loading";
  return (
    <div className="ul-lim">
      <p className="ul-lim__intro">{t("lim.intro")}</p>
      {limits.error && (
        <InlineAlert
          message={t("lim.loadError", { error: limits.error })}
          retrying={limits.fetching}
          onRetry={() => void app.limits.fetch(true).catch(() => undefined)}
        />
      )}
      {enabled.map((id) => {
        const p = limits.providers.find((x) => x.id === id);
        if (p) return <ProviderCard key={id} p={p} now={now} />;
        return loading ? <ProviderSkeleton key={id} id={id} /> : null;
      })}
      {hidden.length > 0 && enabled.length > 0 && (
        <p className="ul-lim__hidden">
          {t("lim.hidden", { names: hidden.join(" / ") })} ·{" "}
          <Button variant="ghost" size="sm" className="ul-linkbtn" onClick={() => app.openSettings()}>
            {t("lim.gotoSettings")}
          </Button>
        </p>
      )}
      {!enabled.length && (
        <section className="ul-card ul-empty">
          <h3>{t("lim.noneTitle")}</h3>
          <p>{t("lim.noneBody")}</p>
          <Button variant="secondary" size="sm" onClick={() => app.openSettings()}>
            {t("lim.gotoSettings")}
          </Button>
        </section>
      )}
    </div>
  );
}
