import type { ReactNode } from "react";

// ===================================================================
// Mockup-un `.tbl`/`table` qabığı (Mərhələ 5) — konkret sütunlar
// PositionsTable/TradesTable-də, bu fayl yalnız paylaşılan stil.
// ===================================================================

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export const tableClass = "w-full min-w-[560px] border-collapse text-[13px]";
export const thClass =
  "whitespace-nowrap border-b border-border px-2.5 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted";
export const tdClass = "whitespace-nowrap border-b border-border/55 px-2.5 py-2.5";
