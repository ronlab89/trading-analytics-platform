import { create } from "zustand";
import { DEFAULT_LANGUAGE, type Language } from "@/i18n/resources";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

/** Owns the active language; `@/i18n` follows it. The browser language is never read (ADR-010 point 8). */
export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    set({ language });
  },
}));
