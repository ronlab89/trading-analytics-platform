export const LANGUAGES = ["en", "es"] as const;
export type Language = (typeof LANGUAGES)[number];

/** English is the initial language and the fallback (ADR-010 point 8). */
export const DEFAULT_LANGUAGE: Language = "en";

const en = {
  app: { title: "Trading Analytics Platform" },
  notFound: { title: "Page not found", back: "Back to the start" },
} as const;

type Messages = { [K in keyof typeof en]: { [P in keyof (typeof en)[K]]: string } };

const es: Messages = {
  app: { title: "Plataforma de Análisis de Trading" },
  notFound: { title: "Página no encontrada", back: "Volver al inicio" },
};

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;
