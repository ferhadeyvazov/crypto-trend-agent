import { useTranslation } from "react-i18next";
import { useMetrics } from "../hooks/useMetrics.ts";
import { useEquityCurve } from "../hooks/useEquityCurve.ts";
import { StatCard } from "./StatCard.tsx";
import { computeDrawdownPeriod } from "./EquityCurveChart.tsx";
import { formatPct, formatDateShort, pnlTone } from "../lib/format.ts";

export function MetricsPanel() {
  const { t } = useTranslation();
  const { data } = useMetrics();
  const { data: curve } = useEquityCurve();

  const metrics = data?.metrics;
  const wins = metrics ? Math.round(metrics.winRate * metrics.tradeCount) : 0;
  const losses = metrics ? metrics.tradeCount - wins : 0;
  const drawdown = curve ? computeDrawdownPeriod(curve) : null;
  const hasDrawdown = drawdown !== null && drawdown.ddPct > 0.01;

  return (
    <div className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
      <StatCard
        label={t("win_rate")}
        value={metrics ? formatPct(metrics.winRate * 100) : "—"}
        delta={metrics ? `${wins} W / ${losses} L` : undefined}
      />
      <StatCard
        label={t("profit_factor")}
        value={metrics ? (Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞") : "—"}
        delta={t("pf_desc")}
      />
      <StatCard
        label={t("max_dd")}
        value={metrics ? `−${metrics.maxDrawdownPct.toFixed(1)}%` : "—"}
        valueTone={metrics && metrics.maxDrawdownPct > 0.01 ? "down" : undefined}
        delta={hasDrawdown ? `${formatDateShort(drawdown!.peakTs)} – ${formatDateShort(drawdown!.troughTs)}` : undefined}
      />
      <StatCard
        label={t("avg_r")}
        value={metrics ? `${metrics.avgRMultiple >= 0 ? "+" : ""}${metrics.avgRMultiple.toFixed(2)}R` : "—"}
        valueTone={metrics ? pnlTone(metrics.avgRMultiple) : undefined}
        delta={t("per_trade")}
      />
    </div>
  );
}
