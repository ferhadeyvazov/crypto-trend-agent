import { useTranslation } from "react-i18next";
import { navItems, type PageId } from "./navItems.tsx";

interface BottomNavProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export function BottomNav({ activePage, onNavigate }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-[60] grid grid-cols-5 border-t border-border bg-panel/97 px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm mobile:hidden"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className={`flex min-h-12 flex-col items-center justify-center gap-[3px] rounded-lg text-[10px] font-medium transition-colors focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber ${
            activePage === item.id ? "text-amber" : "text-muted"
          }`}
        >
          <span className="[&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
