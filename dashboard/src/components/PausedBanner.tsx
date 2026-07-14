import { useTranslation } from "react-i18next";

export function PausedBanner() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-amber/35 bg-amber/9 px-6 py-2.5 text-[13px] text-amber max-mobile:px-4"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
      <span>{t("paused_banner")}</span>
    </div>
  );
}
