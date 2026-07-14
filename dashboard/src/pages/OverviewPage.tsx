import { useTranslation } from "react-i18next";
import { usePortfolio } from "../hooks/usePortfolio.ts";
import { usePositions } from "../hooks/usePositions.ts";
import { StatCard } from "../components/StatCard.tsx";
import { PositionsTable } from "../components/PositionsTable.tsx";
import { formatUsd, formatPct, pnlTone } from "../lib/format.ts";

export function OverviewPage() {
  const { t } = useTranslation();
  const { data: portfolio } = usePortfolio();
  const { data: positions } = usePositions();

  const unrealizedTotal = (positions ?? []).reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
        <StatCard
          label={t("equity")}
          value={portfolio ? formatUsd(portfolio.equity) : "—"}
          delta={portfolio ? `${formatPct(portfolio.allTimePnlPct, { signed: true })} ${t("all_time")}` : undefined}
          deltaTone={portfolio ? pnlTone(portfolio.allTimePnlPct) : undefined}
        />
        <StatCard
          label={t("today_pnl")}
          value={portfolio ? formatUsd(portfolio.dailyPnlUsd, { signed: true }) : "—"}
          valueTone={portfolio ? pnlTone(portfolio.dailyPnlUsd) : undefined}
          delta={portfolio ? formatPct(portfolio.dailyPnlPct, { signed: true }) : undefined}
          deltaTone={portfolio ? pnlTone(portfolio.dailyPnlPct) : undefined}
        />
        <StatCard
          label={t("unrealized_pnl")}
          value={formatUsd(unrealizedTotal, { signed: true })}
          valueTone={pnlTone(unrealizedTotal)}
          delta={`${positions?.length ?? 0} ${t("open_pos_count")}`}
        />
        <StatCard
          label={t("risk_exposure")}
          value={portfolio ? formatPct(portfolio.openRiskPct * 100) : "—"}
          delta={t("at_stop")}
        />
      </div>

      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("open_positions")}</h2>
        <PositionsTable />
      </div>
    </>
  );
}
