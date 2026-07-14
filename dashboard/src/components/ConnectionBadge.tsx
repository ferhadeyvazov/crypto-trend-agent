import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSocket } from "../hooks/useSocket.ts";
import { getHealth } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";

/** Mockup-da ≤480px-də gizlədilir — yer engine control-a verilir. */
export function ConnectionBadge() {
  const { t } = useTranslation();
  const { connected } = useSocket();
  const { dataUpdatedAt } = useQuery({ queryKey: queryKeys.health, queryFn: getHealth });
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)) : null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted max-[480px]:hidden">
      <span className={`h-2 w-2 rounded-full ${connected ? "bg-green motion-safe:animate-pulse" : "bg-red"}`} />
      <span>{connected ? t("live") : "offline"}</span>
      {secondsAgo !== null && (
        <>
          <span>·</span>
          <span>{t("updated")}</span>
          <span className="tabular-num text-fg">{secondsAgo}s</span>
          <span>{t("ago")}</span>
        </>
      )}
    </div>
  );
}
