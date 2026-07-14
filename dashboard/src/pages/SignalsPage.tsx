import { useTranslation } from "react-i18next";
import { RegimeGrid } from "../components/RegimeGrid.tsx";
import { SignalFeed } from "../components/SignalFeed.tsx";

export function SignalsPage() {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 tablet:grid-cols-2">
      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("regime_by_symbol")}</h2>
        <RegimeGrid />
      </div>
      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("signal_stream")}</h2>
        <SignalFeed limit={30} />
      </div>
    </div>
  );
}
