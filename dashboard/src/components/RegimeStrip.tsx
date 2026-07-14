export type RegimeBias = "bull" | "neutral" | "bear";
/** Açıq mövqə statusu — sistemdə ayrıca "1H rejim" YOXDUR (TRAIDERIM_V2_PLAN.md-in RegimeStrip düzəlişi, mockup-un "1H bias"-ını override edir). */
export type PositionBias = "long" | "short" | "flat";

export interface RegimeStripItem {
  symbol: string;
  regime4h: RegimeBias;
  positionBias: PositionBias;
}

interface RegimeStripProps {
  regimes: RegimeStripItem[];
}

const regimeBarClass: Record<RegimeBias, string> = {
  bull: "bg-green",
  bear: "bg-red",
  neutral: "bg-neutral",
};

const positionDotClass: Record<PositionBias, string> = {
  long: "bg-green",
  short: "bg-red",
  flat: "bg-neutral",
};

const positionLabel: Record<PositionBias, string> = {
  long: "long",
  short: "short",
  flat: "no position",
};

/**
 * İmza elementi (plan bölmə 3, "Qətiləşmiş qərarlar" — bütün səhifələrdə görünür).
 * ÜST göstərici = 4H regime (bar). ALT göstərici = açıq mövqə statusu, QƏSDƏN
 * BAR DEYİL (dairə) — rejimlə qarışmasın deyə fərqli forma (plan-ın RegimeStrip
 * düzəlişi, mockup-un uydurma "1H bias"-ını override edir).
 */
export function RegimeStrip({ regimes }: RegimeStripProps) {
  if (regimes.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Market regimes"
      className="flex items-center gap-2.5 overflow-x-auto border-b border-border bg-panel/50 px-6 py-3 max-mobile:px-4 max-mobile:py-2.5"
    >
      {regimes.map((r) => (
        <button
          key={r.symbol}
          role="listitem"
          type="button"
          className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border bg-panel px-3.5 py-2 transition-colors hover:border-amber hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          <span className="font-mono text-[13px] font-semibold">{r.symbol}</span>
          <span className="flex flex-col items-start gap-[5px]">
            <span className={`h-[5px] w-[34px] rounded-[3px] ${regimeBarClass[r.regime4h]}`} />
            <span className={`h-[7px] w-[7px] rounded-full ${positionDotClass[r.positionBias]}`} />
          </span>
          <span className="text-[10px] leading-tight text-muted">
            4H {r.regime4h}
            <br />
            {positionLabel[r.positionBias]}
          </span>
        </button>
      ))}
      <div className="flex shrink-0 items-center gap-3 pl-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-[5px] w-[14px] rounded-[3px] bg-neutral" /> 4H regime
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] rounded-full bg-neutral" /> position
        </span>
      </div>
    </div>
  );
}
