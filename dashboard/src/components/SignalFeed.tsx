import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSignals } from "../hooks/useSignals.ts";

function formatTimeOnly(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface SignalFeedProps {
  limit?: number;
}

/** Mockup-un `.sig` lentinin canlı versiyası — yeni siqnal (socket `signal:new` → invalidateQueries) qısa "pulse" ilə vurğulanır. */
export function SignalFeed({ limit = 20 }: SignalFeedProps) {
  const { t } = useTranslation();
  const { data: signals, isLoading, isError } = useSignals({ limit });

  const seenKeys = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [pulseKeys, setPulseKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!signals) return;
    const keys = signals.map((s) => `${s.symbol}-${s.createdAt}`);
    if (!initialized.current) {
      initialized.current = true;
      seenKeys.current = new Set(keys);
      return;
    }
    const fresh = keys.filter((k) => !seenKeys.current.has(k));
    if (fresh.length === 0) return;
    keys.forEach((k) => seenKeys.current.add(k));
    setPulseKeys(new Set(fresh));
    const timer = setTimeout(() => setPulseKeys(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [signals]);

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError) return <p className="text-sm text-red">{t("load_error")}</p>;
  if (!signals || signals.length === 0) return <p className="text-sm text-muted">{t("no_data")}</p>;

  return (
    <div className="flex max-h-[420px] flex-col gap-2.5 overflow-auto">
      {signals.map((s) => {
        const key = `${s.symbol}-${s.createdAt}`;
        const isNew = pulseKeys.has(key);
        return (
          <div
            key={key}
            className={`flex gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-1000 ${
              isNew ? "border-amber/50 bg-panel-2" : "border-border bg-panel-2"
            }`}
          >
            <span className="w-11 shrink-0 font-mono text-[11px] text-muted">{formatTimeOnly(s.createdAt)}</span>
            <div className="text-[13px]">
              <b className="font-mono font-semibold">{s.symbol}</b> {s.timeframe} entry · {s.type}
            </div>
          </div>
        );
      })}
    </div>
  );
}
