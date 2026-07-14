import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { useEquityCurve } from "../hooks/useEquityCurve.ts";
import { colors } from "../theme/tokens.ts";
import { formatUsd, formatDateShort, formatDateTime } from "../lib/format.ts";

export interface DrawdownPeriod {
  peakTs: number;
  troughTs: number;
  ddPct: number;
}

/** Backend-in `computeMaxDrawdownPct`-i (src/reporting/equityCurve.ts) ilə EYNİ düstur —
 * fərq: burada faizlə yanaşı zirvə/dib TARİXLƏRİ də saxlanılır (mockup-un DD vurğusu üçün,
 * bu tarixlər heç bir backend sahəsində yoxdur, ona görə eyni datadan frontend-də törədilir). */
export function computeDrawdownPeriod(curve: { timestamp: number; equity: number }[]): DrawdownPeriod | null {
  if (curve.length === 0) return null;
  let peak = curve[0]!.equity;
  let peakTs = curve[0]!.timestamp;
  let maxDd = 0;
  let result: DrawdownPeriod | null = null;
  for (const point of curve) {
    if (point.equity > peak) {
      peak = point.equity;
      peakTs = point.timestamp;
    }
    const dd = peak > 0 ? (peak - point.equity) / peak : 0;
    if (dd > maxDd) {
      maxDd = dd;
      result = { peakTs, troughTs: point.timestamp, ddPct: dd * 100 };
    }
  }
  return result;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { timestamp: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!;
  return (
    <div className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs">
      <div className="text-muted">{formatDateTime(point.payload.timestamp)}</div>
      <div className="tabular-num font-semibold text-fg">{formatUsd(point.value)}</div>
    </div>
  );
}

export function EquityCurveChart() {
  const { t } = useTranslation();
  const { data: curve, isLoading, isError } = useEquityCurve();

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError) return <p className="text-sm text-red">{t("load_error")}</p>;
  if (!curve || curve.length < 2) return <p className="text-sm text-muted">{t("no_trades")}</p>;

  const drawdown = computeDrawdownPeriod(curve);

  return (
    <div>
      {drawdown && drawdown.ddPct > 0.01 && (
        <div className="mb-2 font-mono text-[11px] text-muted">
          max DD −{drawdown.ddPct.toFixed(1)}% ({formatDateShort(drawdown.peakTs)} – {formatDateShort(drawdown.troughTs)})
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={curve} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.amber} stopOpacity={0.22} />
              <stop offset="100%" stopColor={colors.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v: number) => formatDateShort(v)}
            stroke={colors.muted}
            tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v: number) => formatUsd(v)}
            stroke={colors.muted}
            tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            width={80}
          />
          <Tooltip content={<ChartTooltip />} />
          {drawdown && drawdown.ddPct > 0.01 && (
            <ReferenceArea x1={drawdown.peakTs} x2={drawdown.troughTs} fill={colors.red} fillOpacity={0.06} />
          )}
          <Area type="monotone" dataKey="equity" stroke={colors.amber} strokeWidth={2} fill="url(#equityGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
