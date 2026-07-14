import { useTranslation } from "react-i18next";
import { navItems, type PageId } from "./navItems.tsx";

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-border p-3 mobile:flex mobile:w-[216px]"
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-[18px] pt-1">
        <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-amber font-mono text-[15px] font-semibold text-bg">
          T
        </div>
        <div className="font-semibold tracking-[.2px]">Traiderim</div>
        <div className="ml-auto font-mono text-[11px] text-muted">v2</div>
      </div>

      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2 ${
            activePage === item.id
              ? "bg-panel-2 text-fg [&_svg]:text-amber"
              : "text-muted hover:bg-panel hover:text-fg"
          }`}
        >
          {item.icon}
          <span>{t(item.labelKey)}</span>
        </button>
      ))}

      <div className="mt-auto p-2.5 text-xs text-muted">
        {t("paper_day")} <span className="tabular-num text-fg">—</span>/60 · {t("strategy")}{" "}
        <span className="tabular-num text-fg">v1.0</span>
      </div>
    </nav>
  );
}
