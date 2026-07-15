import type { ReactNode } from "react";

// ===================================================================
// Naviqasiya siyahısı (Sidebar + BottomNav eyni siyahını istifadə edir)
// və mockup-dakı eyni SVG ikonlar (docs/design/fedya-traider-dashboard-mockup.html).
// ===================================================================

export type PageId = "overview" | "trades" | "signals" | "performance" | "health";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[17px] w-[17px] shrink-0">
      {children}
    </svg>
  );
}

export const navItems: { id: PageId; labelKey: string; icon: ReactNode }[] = [
  {
    id: "overview",
    labelKey: "nav_overview",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </Icon>
    ),
  },
  {
    id: "trades",
    labelKey: "nav_trades",
    icon: (
      <Icon>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </Icon>
    ),
  },
  {
    id: "signals",
    labelKey: "nav_signals",
    icon: (
      <Icon>
        <path d="M2 12h4l3-8 4 16 3-8h6" />
      </Icon>
    ),
  },
  {
    id: "performance",
    labelKey: "nav_performance",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </Icon>
    ),
  },
  {
    id: "health",
    labelKey: "nav_health",
    icon: (
      <Icon>
        <path d="M22 12h-4l-3 8-6-16-3 8H2" />
      </Icon>
    ),
  },
];
