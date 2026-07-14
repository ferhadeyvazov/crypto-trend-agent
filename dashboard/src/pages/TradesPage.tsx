import { useTranslation } from "react-i18next";
import { TradesTable } from "../components/TradesTable.tsx";

export function TradesPage() {
  const { t } = useTranslation();

  return (
    <div className="rounded-[10px] border border-border bg-panel p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("closed_trades")}</h2>
      <TradesTable />
    </div>
  );
}
