import type { ReactNode } from "react";

type BadgeVariant = "long" | "short" | "rule" | "info" | "tier1" | "tier2";

const variantClass: Record<BadgeVariant, string> = {
  long: "bg-green/14 text-green",
  short: "bg-red/14 text-red",
  rule: "bg-amber/12 font-mono text-amber",
  info: "bg-neutral/18 text-[#b6c2d6]",
  tier1: "bg-tier1/14 text-tier1",
  tier2: "bg-tier2/14 text-tier2",
};

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${variantClass[variant]}`}>
      {children}
    </span>
  );
}
