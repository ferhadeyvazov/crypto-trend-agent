export type RegimeBias = "bull" | "neutral" | "bear";

export interface RegimeStripItem {
  symbol: string;
  regime4h: RegimeBias;
  regime1h: RegimeBias;
}

interface RegimeStripProps {
  regimes: RegimeStripItem[];
}

const barClass: Record<RegimeBias, string> = {
  bull: "bg-green",
  bear: "bg-red",
  neutral: "bg-neutral",
};

/**
 * İmza elementi (plan bölmə 3, "Qətiləşmiş qərarlar" — bütün səhifələrdə görünür).
 * Mərhələ 4-də sırf presentational-dır — canlı /api/signals qoşulması Mərhələ 7-dədir,
 * ona görə boş massiv gələndə heç nə render etmir.
 */
export function RegimeStrip({ regimes }: RegimeStripProps) {
  if (regimes.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Market regimes"
      className="flex gap-2.5 overflow-x-auto border-b border-border bg-panel/50 px-6 py-3 max-mobile:px-4 max-mobile:py-2.5"
    >
      {regimes.map((r) => (
        <button
          key={r.symbol}
          role="listitem"
          type="button"
          className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border bg-panel px-3.5 py-2 transition-colors hover:border-amber hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          <span className="font-mono text-[13px] font-semibold">{r.symbol}</span>
          <span className="flex flex-col gap-[3px]">
            <span className={`h-[5px] w-[34px] rounded-[3px] ${barClass[r.regime4h]}`} />
            <span className={`h-[5px] w-[34px] rounded-[3px] ${barClass[r.regime1h]}`} />
          </span>
          <span className="text-[10px] leading-tight text-muted">
            4H {r.regime4h}
            <br />
            1H {r.regime1h}
          </span>
        </button>
      ))}
    </div>
  );
}
