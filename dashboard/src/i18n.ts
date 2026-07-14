import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import az from "./locales/az.json";
import tr from "./locales/tr.json";

// ===================================================================
// react-i18next (plan bölmə 3) — EN/AZ/TR. Texniki terminlər (rule
// code, LONG/SHORT, P&L) tərcümə olunmur — bunlar tərcümə açarlarına
// heç daxil edilməyib, komponentlərdə birbaşa istifadə olunur.
// ===================================================================

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    az: { translation: az },
    tr: { translation: tr },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
