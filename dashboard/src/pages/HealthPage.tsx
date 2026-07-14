import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";
import { formatDateTime } from "../lib/format.ts";

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-green" : "bg-amber"}`} />;
}

/**
 * Mockup-un "System status" grid-i 4 kartla (o cümlədən CoinGecko retry sayı v.
 * "next tick in Xs" geri-sayımı) göstərir — bunlar heç bir backend sahəsində
 * YOXDUR (Mərhələ 7 qərarı), uydurulmur, sadəcə göstərilmir. Yalnız real 3 kart:
 * Engine, Scheduler, Data feed.
 */
export function HealthPage() {
  const { t } = useTranslation();
  const { data: health, isLoading, isError } = useQuery({ queryKey: queryKeys.health, queryFn: getHealth });

  if (isLoading) return <p className="text-sm text-muted">{t("loading")}</p>;
  if (isError || !health) return <p className="text-sm text-red">{t("load_error")}</p>;

  return (
    <>
      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("system_status")}</h2>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <div className="flex items-center gap-3">
            <StatusDot ok={health.engineState === "running"} />
            <div>
              <div className="text-sm font-semibold">{t("engine")}</div>
              <div className="text-xs text-muted">
                {health.engineState === "running" ? t("running") : t("paused")} · {t("since")}{" "}
                <span className="tabular-num text-fg">
                  {health.stateChangedAt ? formatDateTime(health.stateChangedAt) : "—"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot ok={health.schedulerStatus === "running"} />
            <div>
              <div className="text-sm font-semibold">{t("scheduler")}</div>
              <div className="text-xs text-muted">
                {health.schedulerStatus === "running" ? t("running") : health.schedulerStatus}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot ok={health.schedulerStatus === "running"} />
            <div>
              <div className="text-sm font-semibold">{t("data_feed")}</div>
              <div className="text-xs text-muted">
                {t("last_fetch")}{" "}
                <span className="tabular-num text-fg">
                  {health.lastFetchAt ? formatDateTime(health.lastFetchAt) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("state_log")}</h2>
        {health.stateLog.length === 0 ? (
          <p className="text-sm text-muted">{t("no_data")}</p>
        ) : (
          <div className="flex flex-col gap-2 font-mono text-xs">
            {[...health.stateLog].reverse().map((entry, i) => (
              <div key={i} className="flex gap-3 rounded-md bg-panel-2 px-2.5 py-2">
                <span className="text-muted">{formatDateTime(entry.changedAt)}</span>
                <span className={entry.state === "running" ? "text-green" : "text-amber"}>
                  {entry.state === "running" ? "STARTED" : "PAUSED"}
                </span>
                <span className="text-muted">{entry.reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[10px] border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("recent_log")}</h2>
        {health.recentEvents.length === 0 ? (
          <p className="text-sm text-muted">{t("no_data")}</p>
        ) : (
          <div className="flex flex-col gap-2 font-mono text-xs">
            {[...health.recentEvents].reverse().map((line, i) => {
              const tone = line.includes(" ERROR ") ? "text-red" : line.includes(" WARN ") ? "text-amber" : "text-muted";
              return (
                <div key={i} className={`rounded-md bg-panel-2 px-2.5 py-2 ${tone}`}>
                  {line}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
