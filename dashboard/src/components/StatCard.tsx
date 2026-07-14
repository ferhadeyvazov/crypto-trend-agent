import type { ReactNode } from "react";
import { pnlToneClass, type PnlTone } from "../lib/format.ts";

interface StatCardProps {
  label: string;
  value: string;
  valueTone?: PnlTone;
  delta?: ReactNode;
  deltaTone?: PnlTone;
}

export function StatCard({ label, value, valueTone, delta, deltaTone }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-[10px] border border-border bg-panel p-4 max-mobile:p-3.5">
      <div className="mb-1.5 text-xs text-muted">{label}</div>
      <div
        className={`tabular-num text-2xl font-semibold max-mobile:text-xl ${valueTone ? pnlToneClass[valueTone] : ""}`}
      >
        {value}
      </div>
      {delta !== undefined && (
        <div className={`tabular-num mt-1 text-xs ${deltaTone ? pnlToneClass[deltaTone] : "text-muted"}`}>{delta}</div>
      )}
    </div>
  );
}
