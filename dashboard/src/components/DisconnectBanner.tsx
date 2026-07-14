import { useTranslation } from "react-i18next";

/** `PausedBanner`-in eyni quruluşu, qırmızı ton — socket bağlantısı kəsiləndə (Mərhələ 8). */
export function DisconnectBanner() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-red/35 bg-red/9 px-6 py-2.5 text-[13px] text-red max-mobile:px-4"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
        <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0122.58 9" />
        <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
        <path d="M8.53 16.11a6 6 0 016.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>{t("disconnected_banner")}</span>
    </div>
  );
}
