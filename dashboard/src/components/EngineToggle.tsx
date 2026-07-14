import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getHealth, startEngine, stopEngine } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import type { SystemHealth } from "@shared/types.ts";
import { ApiError } from "../lib/http.ts";

/** Header-də ConnectionBadge yanında (plan Feature 7) — real POST /api/engine/start|stop, Confirm dialoqu məcburidir. */
export function EngineToggle() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: health } = useQuery({ queryKey: queryKeys.health, queryFn: getHealth });
  const [dialogOpen, setDialogOpen] = useState(false);

  // health hələ yüklənməyibsə mockup-un ilkin vəziyyəti kimi "running" göstərilir.
  const running = health?.engineState !== "paused";

  const mutation = useMutation({
    mutationFn: (reason: string) => (running ? stopEngine(reason) : startEngine(reason)),
    onSuccess: (updatedHealth) => {
      queryClient.setQueryData<SystemHealth>(queryKeys.health, (old) => (old ? { ...old, ...updatedHealth } : updatedHealth));
      setDialogOpen(false);
    },
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-[7px] rounded-full border border-border px-3 py-1.5 text-xs font-semibold ${
            running ? "text-green" : "text-amber"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${running ? "bg-green" : "bg-amber"}`} />
          <span>{running ? t("running") : t("paused")}</span>
        </span>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={`rounded-lg px-3.5 py-[7px] text-xs font-semibold transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg focus-visible:outline-offset-2 ${
            running ? "border border-amber/40 bg-amber/15 text-amber" : "border border-green/40 bg-green/15 text-green"
          }`}
        >
          {running ? t("btn_stop") : t("btn_start")}
        </button>
        {mutation.isError && (
          <span className="text-xs text-red">
            {mutation.error instanceof ApiError ? mutation.error.message : "error"}
          </span>
        )}
      </div>

      <ConfirmDialog
        open={dialogOpen}
        variant={running ? "stop" : "start"}
        title={running ? t("confirm_stop_title") : t("confirm_start_title")}
        description={running ? t("confirm_stop_text") : t("confirm_start_text")}
        cancelLabel={t("cancel")}
        confirmLabel={t("confirm")}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => mutation.mutate("manual (dashboard)")}
      />
    </>
  );
}
