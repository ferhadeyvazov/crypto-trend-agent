import { useTranslation } from "react-i18next";
import { MetricsPanel } from "../components/MetricsPanel.tsx";
import { EquityCurveChart } from "../components/EquityCurveChart.tsx";
import { GoLiveProgress } from "../components/GoLiveProgress.tsx";

export function PerformancePage() {
  const { t } = useTranslation();

  return (
    <>
      <MetricsPanel />

      <div className="grid gap-4 tablet:grid-cols-[1.6fr_1fr]">
        <div className="rounded-[10px] border border-border bg-panel p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("equity_full")}</h2>
          <EquityCurveChart />
        </div>
        <div className="rounded-[10px] border border-border bg-panel p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("golive")}</h2>
          <GoLiveProgress />
        </div>
      </div>
    </>
  );
}
