import { useEffect } from "react";
import { LANGUAGES } from "@trading/contracts";
import { useLanguageStore } from "@/stores/language-store";
import { usePreferences } from "./use-preferences";

const isLanguage = (value: string): value is (typeof LANGUAGES)[number] =>
  (LANGUAGES as readonly string[]).includes(value);

/**
 * Makes the app speak the language the user saved. The saved preference is the one source: saving a
 * new language in Settings updates the same query, so this applies it too. With nothing saved, or a
 * language the app does not have, the current one stays (the browser language is never read).
 */
export function useSavedLanguage() {
  const language = usePreferences().data?.language;
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  useEffect(() => {
    if (language !== undefined && isLanguage(language)) {
      setLanguage(language);
    }
  }, [language, setLanguage]);
}
