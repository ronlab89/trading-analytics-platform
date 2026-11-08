import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { useLanguageStore } from "@/stores/language-store";
import { DEFAULT_LANGUAGE, resources } from "./resources";

function applyLanguage(language: string): void {
  void i18n.changeLanguage(language);
  document.documentElement.lang = language;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: useLanguageStore.getState().language,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

useLanguageStore.subscribe((state, previous) => {
  if (state.language !== previous.language) {
    applyLanguage(state.language);
  }
});

export { i18n };
