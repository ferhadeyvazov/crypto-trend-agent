// ===================================================================
// Görüntü formatlaşdırma köməkçiləri (Mərhələ 5). Sırf təqdimat —
// heç bir maliyyə/strategiya hesablaması aparmır.
// ===================================================================

export function formatUsd(value: number, opts: { signed?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(value);
}

export function formatPct(value: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Qrafik X-ox etiketləri üçün qısa tarix (Mərhələ 6) — `formatDateTime`-dan fərqli olaraq saat yoxdur. */
export function formatDateShort(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "2-digit" });
}

export type PnlTone = "up" | "down" | "mut";

/** Mockup-un `.up`/`.down`/`.mut` (yaşıl/qırmızı/solğun) rəng kodlaması. */
export function pnlTone(value: number): PnlTone {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "mut";
}

export const pnlToneClass: Record<PnlTone, string> = {
  up: "text-green",
  down: "text-red",
  mut: "text-muted",
};
