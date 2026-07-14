import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar.tsx";
import { BottomNav } from "./BottomNav.tsx";
import { Footer } from "./Footer.tsx";
import { navItems, type PageId } from "./navItems.tsx";
import { RegimeStrip } from "../components/RegimeStrip.tsx";
import { ConnectionBadge } from "../components/ConnectionBadge.tsx";
import { EngineToggle } from "../components/EngineToggle.tsx";
import { PausedBanner } from "../components/PausedBanner.tsx";
import { useSocket } from "../hooks/useSocket.ts";
import { getHealth } from "../api/client.ts";
import { queryKeys } from "../lib/queryKeys.ts";
import { OverviewPage } from "../pages/OverviewPage.tsx";
import { TradesPage } from "../pages/TradesPage.tsx";
import { SignalsPage } from "../pages/SignalsPage.tsx";
import { PerformancePage } from "../pages/PerformancePage.tsx";
import { HealthPage } from "../pages/HealthPage.tsx";

const pageComponents: Record<PageId, () => React.JSX.Element> = {
  overview: OverviewPage,
  trades: TradesPage,
  signals: SignalsPage,
  performance: PerformancePage,
  health: HealthPage,
};

const LANGUAGES = ["en", "az", "tr"] as const;

export function AppLayout() {
  const { t, i18n } = useTranslation();
  const [activePage, setActivePage] = useState<PageId>("overview");
  useSocket(); // socket.io hadisələrini query cache-ə bağlayır (bax hooks/useSocket.ts)
  const { data: health } = useQuery({ queryKey: queryKeys.health, queryFn: getHealth });

  const ActivePageComponent = pageComponents[activePage];
  const activeLabelKey = navItems.find((n) => n.id === activePage)!.labelKey;
  const paused = health?.engineState === "paused";

  return (
    <div className="grid min-h-screen mobile:grid-cols-[216px_1fr]">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-3.5 border-b border-border px-6 py-3.5 max-mobile:gap-2.5 max-mobile:px-4 max-mobile:py-3">
          <div>
            <h1 className="text-base font-semibold">{t(activeLabelKey)}</h1>
            <div className="hidden text-xs text-muted mobile:block">{t("subtitle")}</div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <EngineToggle />
            <select
              aria-label="Language"
              value={i18n.language}
              onChange={(e) => void i18n.changeLanguage(e.target.value)}
              className="cursor-pointer rounded-[7px] border border-border bg-panel-2 px-2.5 py-1.5 text-xs text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
            >
              {LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {lng.toUpperCase()}
                </option>
              ))}
            </select>
            <ConnectionBadge />
          </div>
        </header>

        {paused && <PausedBanner />}

        <RegimeStrip regimes={[]} />

        <main className="grid flex-1 gap-4 p-6 max-mobile:gap-3 max-mobile:p-4 max-mobile:pb-[88px]">
          <ActivePageComponent />
        </main>

        <Footer />
      </div>

      <BottomNav activePage={activePage} onNavigate={setActivePage} />
    </div>
  );
}
