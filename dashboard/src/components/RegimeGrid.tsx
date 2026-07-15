import { useTranslation } from "react-i18next";
import { useRegimes } from "../hooks/useRegimes.ts";
import { usePositions } from "../hooks/usePositions.ts";
import { useSignals } from "../hooks/useSignals.ts";
import { Badge } from "./Badge.tsx";
import { TableScroll, tableClass, thClass, tdClass } from "./DataTable.tsx";
import { formatDateShort } from "../lib/format.ts";
import type { Signal, RegimeSnapshot } from "@shared/types.ts";

const regimeBadgeVariant: Record<RegimeSnapshot["regime4h"], "long" | "short" | "info"> = {
  bull: "long",
  bear: "short",
  neutral: "info",
};
const regimeLabel: Record<RegimeSnapshot["regime4h"], string> = { bull: "BULL", bear: "BEAR", neutral: "NEUTRAL" };

type PositionBias = "long" | "short" | "flat";
const positionClass: Record<PositionBias, string> = { long: "text-green", short: "text-red", flat: "text-muted" };
const positionLabel: Record<PositionBias, string> = { long: "LONG", short: "SHORT", flat: "—" };

/**
 * "Position" sütunu (əvvəllər "1H bias") — sistemdə ayrıca 1H rejim YOXDUR, ona görə
 * açıq mövqənin İSTİQAMƏTİ göstərilir (FEDYA_TRAIDER_V2_PLAN.md-in RegimeStrip düzəlişi,
 * mockup-un uydurma "1H bias"-ını override edir).
 */
function positionBias(side: "long" | "short" | undefined): PositionBias {
  if (side === "long") return "long";
  if (side === "short") return "short";
  return "flat";
}

export function RegimeGrid() {
  const { t } = useTranslation();
  const { data: regimes, isLoading, isError } = useRegimes();
  const { data: positions } = usePositions();
  const { data: signals } = useSignals({ limit: 200 });

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError) return <p className="text-sm text-red">{t("load_error")}</p>;
  if (!regimes || regimes.length === 0) return <p className="text-sm text-muted">{t("no_data")}</p>;

  const positionBySymbol = new Map((positions ?? []).map((p) => [p.symbol, p]));
  const lastSignalBySymbol = new Map<string, Signal>();
  for (const s of signals ?? []) {
    const existing = lastSignalBySymbol.get(s.symbol);
    if (!existing || s.createdAt > existing.createdAt) lastSignalBySymbol.set(s.symbol, s);
  }

  return (
    <TableScroll>
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>{t("th_symbol")}</th>
            <th className={thClass}>4H regime</th>
            <th className={thClass}>{t("th_since")}</th>
            <th className={thClass}>Position</th>
            <th className={thClass}>{t("th_last_signal")}</th>
          </tr>
        </thead>
        <tbody>
          {regimes.map((r) => {
            const bias = positionBias(positionBySymbol.get(r.symbol)?.side);
            const lastSignal = lastSignalBySymbol.get(r.symbol);
            return (
              <tr key={r.symbol} className="transition-colors hover:bg-panel-2">
                <td className={`${tdClass} tabular-num`}>{r.symbol}</td>
                <td className={tdClass}>
                  <Badge variant={regimeBadgeVariant[r.regime4h]}>{regimeLabel[r.regime4h]}</Badge>
                </td>
                <td className={`${tdClass} tabular-num`}>{formatDateShort(r.changedAt)}</td>
                <td className={`${tdClass} tabular-num ${positionClass[bias]}`}>{positionLabel[bias]}</td>
                <td className={`${tdClass} tabular-num`}>
                  {lastSignal ? `${lastSignal.type} · ${formatDateShort(lastSignal.createdAt)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
