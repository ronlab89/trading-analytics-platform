import type { LANGUAGES } from "@trading/contracts";

/** The languages the API accepts in `UserPreference.language`. */
export type Language = (typeof LANGUAGES)[number];

/** English is the initial language and the fallback (ADR-010 point 8). */
export const DEFAULT_LANGUAGE: Language = "en";

const en = {
  app: { title: "Trading Analytics Platform" },
  notFound: { title: "Page not found", back: "Back to the start" },
  nav: {
    home: "Home",
    portfolios: "Portfolios",
    transactions: "Transactions",
    analytics: "Analytics",
    markets: "Markets",
    decisions: "Decision Center",
    activity: "Activity",
    settings: "Settings",
  },
  shell: {
    mainNavigation: "Main navigation",
    userMenu: "User menu",
    viewProfile: "View profile",
    signOut: "Sign out",
  },
} as const;

type Messages = { [K in keyof typeof en]: { [P in keyof (typeof en)[K]]: string } };

const es: Messages = {
  app: { title: "Plataforma de Análisis de Trading" },
  notFound: { title: "Página no encontrada", back: "Volver al inicio" },
  nav: {
    home: "Inicio",
    portfolios: "Portafolios",
    transactions: "Transacciones",
    analytics: "Análisis",
    markets: "Mercados",
    decisions: "Centro de decisiones",
    activity: "Actividad",
    settings: "Configuración",
  },
  shell: {
    mainNavigation: "Navegación principal",
    userMenu: "Menú de usuario",
    viewProfile: "Ver perfil",
    signOut: "Cerrar sesión",
  },
};

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;
