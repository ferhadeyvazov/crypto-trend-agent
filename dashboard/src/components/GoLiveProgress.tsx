import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMetrics } from "../hooks/useMetrics.ts";

function ProgressBar({ label, pct, pass, value }: { label: string; pct: number; pass: boolean; value: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex justify-between text-xs">
        <span>{label}</span>
        <span className={`tabular-num ${pass ? "text-green" : ""}`}>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-[5px] bg-panel-2">
        <div
          className={`h-full rounded-[5px] ${pass ? "bg-green" : "bg-amber"}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

/** Mockup-un 3 "Go-live progress" bar-ı (plan Feature 4) — hədəf ədədləri `GET /api/metrics`-in `goLiveThresholds`-indən (Mərhələ 6-nın backend əlavəsi), strategiya parametri kimi frontend-də hardcode edilmir. */
export function GoLiveProgress() {
  const { t } = useTranslation();
  const { data } = useMetrics();

  if (!data) return <p className="text-sm text-muted">{t("loading")}</p>;
  const { metrics, goLiveThresholds } = data;

  const days = Math.floor(metrics.durationDays);
  const daysPass = days >= goLiveThresholds.minDays;
  const tradesPass = metrics.tradeCount >= goLiveThresholds.minClosedTrades;
  const ddPass = metrics.maxDrawdownPct <= goLiveThresholds.maxDrawdownPct;
  const ddPct = ddPass ? 100 : (metrics.maxDrawdownPct / goLiveThresholds.maxDrawdownPct) * 100;

  return (
    <div>
      <ProgressBar
        label={t("paper_days")}
        pct={(days / goLiveThresholds.minDays) * 100}
        pass={daysPass}
        value={`${days} / ${goLiveThresholds.minDays}`}
      />
      <ProgressBar
        label={t("closed_count")}
        pct={(metrics.tradeCount / goLiveThresholds.minClosedTrades) * 100}
        pass={tradesPass}
        value={`${metrics.tradeCount} / ${goLiveThresholds.minClosedTrades}`}
      />
      <ProgressBar
        label={t("dd_limit")}
        pct={ddPct}
        pass={ddPass}
        value={ddPass ? `✓ ${metrics.maxDrawdownPct.toFixed(1)}%` : `${metrics.maxDrawdownPct.toFixed(1)}%`}
      />
      <p className="mt-2.5 text-xs text-muted">{t("golive_note")}</p>
    </div>
  );
}
