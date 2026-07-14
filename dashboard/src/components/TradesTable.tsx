import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTrades } from "../hooks/useTrades.ts";
import { Badge } from "./Badge.tsx";
import { TableScroll, tableClass, thClass, tdClass } from "./DataTable.tsx";
import { formatUsd, formatDateTime, pnlTone, pnlToneClass } from "../lib/format.ts";

type ResultFilter = "all" | "winners" | "losers";

export function TradesTable() {
  const { t } = useTranslation();
  const { data: trades, isLoading, isError } = useTrades({ limit: 50 });
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  const symbols = useMemo(() => {
    if (!trades) return [];
    return Array.from(new Set(trades.map((tr) => tr.symbol))).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    if (!trades) return [];
    return trades.filter((tr) => {
      if (symbolFilter !== "all" && tr.symbol !== symbolFilter) return false;
      if (resultFilter === "winners" && tr.realizedPnl <= 0) return false;
      if (resultFilter === "losers" && tr.realizedPnl >= 0) return false;
      return true;
    });
  }, [trades, symbolFilter, resultFilter]);

  // Yeni bağlanmış trade-lərə keçici "flash" (closed-trade animasiyası) — socket
  // `trade:closed` -> `useSocket`-in `invalidateQueries`-i -> bura yeni `trades` verilişi gəlir.
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!trades) return;
    if (!initialized.current) {
      initialized.current = true;
      seenIds.current = new Set(trades.map((tr) => tr.id));
      return;
    }
    const freshIds = trades.filter((tr) => !seenIds.current.has(tr.id)).map((tr) => tr.id);
    if (freshIds.length === 0) return;
    trades.forEach((tr) => seenIds.current.add(tr.id));
    setFlashIds(new Set(freshIds));
    const timer = setTimeout(() => setFlashIds(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [trades]);

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError) return <p className="text-sm text-red">{t("load_error")}</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          aria-label="Filter by symbol"
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="cursor-pointer rounded-[7px] border border-border bg-panel-2 px-2.5 py-1.5 text-xs text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          <option value="all">{t("all_symbols")}</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by result"
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
          className="cursor-pointer rounded-[7px] border border-border bg-panel-2 px-2.5 py-1.5 text-xs text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          <option value="all">{t("all_results")}</option>
          <option value="winners">{t("winners")}</option>
          <option value="losers">{t("losers")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">{t("no_trades")}</p>
      ) : (
        <TableScroll>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>{t("th_closed")}</th>
                <th className={thClass}>{t("th_symbol")}</th>
                <th className={thClass}>{t("th_side")}</th>
                <th className={thClass}>{t("th_entry_exit")}</th>
                <th className={thClass}>{t("th_rule")}</th>
                <th className={thClass}>{t("th_exit_reason")}</th>
                <th className={thClass}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tr) => (
                <tr
                  key={tr.id}
                  className={`transition-colors duration-1000 hover:bg-panel-2 ${
                    flashIds.has(tr.id) ? "bg-amber/12" : ""
                  }`}
                >
                  <td className={`${tdClass} tabular-num`}>{formatDateTime(tr.closedAt)}</td>
                  <td className={`${tdClass} tabular-num`}>{tr.symbol}</td>
                  <td className={tdClass}>
                    <Badge variant={tr.side === "long" ? "long" : "short"}>{tr.side.toUpperCase()}</Badge>
                  </td>
                  <td className={`${tdClass} tabular-num`}>
                    {tr.entryPrice.toLocaleString()} → {tr.exitPrice.toLocaleString()}
                  </td>
                  <td className={tdClass}>
                    <Badge variant="rule">{tr.ruleCode}</Badge>
                  </td>
                  <td className={tdClass}>
                    <Badge variant="info">{tr.exitReason}</Badge>
                  </td>
                  <td className={`${tdClass} tabular-num ${pnlToneClass[pnlTone(tr.realizedPnl)]}`}>
                    {formatUsd(tr.realizedPnl, { signed: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}
