import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4 text-xs text-muted max-mobile:justify-center max-mobile:px-4 max-mobile:pb-[90px] max-mobile:pt-3.5 max-mobile:text-center">
      <span>{t("copyright")}</span>
      <span>·</span>
      <span>{t("footer_note")}</span>
      <div className="ml-auto flex gap-3.5 max-mobile:ml-0">
        <span className="tabular-num text-muted">v2.0</span>
        <a
          href="#"
          className="text-muted transition-colors hover:text-fg focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          {t("footer_docs")}
        </a>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener"
          className="text-muted transition-colors hover:text-fg focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber focus-visible:outline-offset-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
