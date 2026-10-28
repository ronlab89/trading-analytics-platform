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
    tabNavigation: "Main tabs",
    more: "More",
    userMenu: "User menu",
    viewProfile: "View profile",
    signOut: "Sign out",
    statusBar: "Status",
    connection: {
      live: "Live",
      connecting: "Connecting…",
      reconnecting: "Reconnecting…",
      offline: "Offline",
    },
    lastSync: {
      syncedAgo: "Synced {{seconds}} s ago",
      lastDataAgo: "Last data {{seconds}} s ago",
      lastDataAt: "Last data {{time}}",
      waiting: "Waiting for the first data",
    },
    calculation: {
      upToDate: "Calculation up to date · {{time}}",
      stopped: "Calculation stopped",
    },
    alerts_one: "{{count}} alert",
    alerts_other: "{{count}} alerts",
    breadcrumb: "Breadcrumb",
    portfolios: "Portfolios",
    selectPortfolio: "Select portfolio",
    demoData: "Demo data",
    demoControls: "Demo controls",
    simulateConnectionIssue: "Simulate a connection problem",
    sendTestNotification: "Send a test notification",
    resetDemo: "Reset demo",
    notifications: "Notifications",
    notificationsUnread_one: "Notifications, {{count}} unread",
    notificationsUnread_other: "Notifications, {{count}} unread",
  },
} as const;

type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

const es: Messages<typeof en> = {
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
    tabNavigation: "Pestañas principales",
    more: "Más",
    userMenu: "Menú de usuario",
    viewProfile: "Ver perfil",
    signOut: "Cerrar sesión",
    statusBar: "Estado",
    connection: {
      live: "En vivo",
      connecting: "Conectando…",
      reconnecting: "Reconectando…",
      offline: "Sin conexión",
    },
    lastSync: {
      syncedAgo: "Sincronizado hace {{seconds}} s",
      lastDataAgo: "Último dato hace {{seconds}} s",
      lastDataAt: "Último dato {{time}}",
      waiting: "Esperando el primer dato",
    },
    calculation: {
      upToDate: "Cálculo al día · {{time}}",
      stopped: "Cálculo detenido",
    },
    alerts_one: "{{count}} alerta",
    alerts_other: "{{count}} alertas",
    breadcrumb: "Ruta de navegación",
    portfolios: "Portafolios",
    selectPortfolio: "Seleccionar portafolio",
    demoData: "Datos demo",
    demoControls: "Controles de la demo",
    simulateConnectionIssue: "Simular problema de conexión",
    sendTestNotification: "Enviar notificación de prueba",
    resetDemo: "Restablecer demo",
    notifications: "Notificaciones",
    notificationsUnread_one: "Notificaciones, {{count}} sin leer",
    notificationsUnread_other: "Notificaciones, {{count}} sin leer",
  },
};

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;
