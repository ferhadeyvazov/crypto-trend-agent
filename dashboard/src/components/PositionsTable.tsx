import { useTranslation } from "react-i18next";
import { usePositions } from "../hooks/usePositions.ts";
import { Badge } from "./Badge.tsx";
import { TableScroll, tableClass, thClass, tdClass } from "./DataTable.tsx";
import { formatUsd, formatPct, pnlTone, pnlToneClass } from "../lib/format.ts";

export function PositionsTable() {
  const { t } = useTranslation();
  const { data: positions, isLoading, isError } = usePositions();

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError) return <p className="text-sm text-red">{t("load_error")}</p>;
  if (!positions || positions.length === 0) return <p className="text-sm text-muted">{t("no_open_positions")}</p>;

  return (
    <TableScroll>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>{t("th_symbol")}</th>
            <th className={thClass}>{t("th_tier")}</th>
            <th className={thClass}>{t("th_side")}</th>
            <th className={thClass}>{t("th_entry")}</th>
            <th className={thClass}>{t("th_size")}</th>
            <th className={thClass}>{t("th_stop")}</th>
            <th className={thClass}>{t("th_target")}</th>
            <th className={thClass}>{t("th_upnl")}</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const pct = p.entryPrice * p.size !== 0 ? (p.unrealizedPnl / (p.entryPrice * p.size)) * 100 : 0;
            return (
              <tr key={p.id} className="transition-colors hover:bg-panel-2">
                <td className={`${tdClass} tabular-num`}>{p.symbol}</td>
                <td className={tdClass}>
                  <Badge variant={p.tier === "TIER2" ? "tier2" : "tier1"}>{p.tier}</Badge>
                </td>
                <td className={tdClass}>
                  <Badge variant={p.side === "long" ? "long" : "short"}>{p.side.toUpperCase()}</Badge>
                </td>
                <td className={`${tdClass} tabular-num`}>{p.entryPrice.toLocaleString()}</td>
                <td className={`${tdClass} tabular-num`}>{p.size}</td>
                <td className={`${tdClass} tabular-num text-red`}>{p.stopLoss.toLocaleString()}</td>
                <td className={`${tdClass} tabular-num text-green`}>{p.takeProfit.toLocaleString()}</td>
                <td className={`${tdClass} tabular-num ${pnlToneClass[pnlTone(p.unrealizedPnl)]}`}>
                  {formatUsd(p.unrealizedPnl, { signed: true })} ({formatPct(pct, { signed: true })})
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
