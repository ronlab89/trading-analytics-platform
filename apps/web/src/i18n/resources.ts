import type { LANGUAGES } from "@trading/contracts";

/** The languages the API accepts in `UserPreference.language`. */
export type Language = (typeof LANGUAGES)[number];

/** English is the initial language and the fallback (ADR-010 point 8). */
export const DEFAULT_LANGUAGE: Language = "en";

const en = {
  app: { title: "Trading Analytics Platform" },
  notFound: { title: "Page not found", back: "Back to the start" },
  auth: {
    restoringSession: "Restoring your session…",
    login: {
      title: "Sign in",
      subtitle: "Sign in with your account to see your portfolio.",
      brand: {
        name: "Trading Analytics",
        headline: "Your portfolio, clear and up to date.",
        subtitle:
          "Follow the performance, the risk and the distribution of your investments in one place.",
      },
      email: "Email",
      emailPlaceholder: "name@example.com",
      passwordPlaceholder: "Your password",
      password: "Password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      emailInvalid: "Enter a valid email",
      passwordRequired: "Enter your password",
      submit: "Sign in",
      submitting: "Signing in…",
      or: "or",
      enterDemo: "Enter the demo",
      enteringDemo: "Entering…",
      demoNote: "No credentials · uses fictional data",
      retry: "Try again",
      offline: {
        title: "No connection",
        description: "Check your internet connection to sign in.",
      },
      failure: {
        credentials: {
          title: "Wrong email or password",
          description: "Check your details and try again.",
        },
        "rate-limited": {
          title: "Too many attempts",
          description: "Wait a few minutes before trying again.",
        },
        unavailable: {
          title: "Service unavailable",
          description: "We could not reach the server. Try again in a few minutes.",
        },
      },
    },
  },
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
  auth: {
    restoringSession: "Restaurando tu sesión…",
    login: {
      title: "Iniciar sesión",
      subtitle: "Ingresa con tu cuenta para ver tu portafolio.",
      brand: {
        name: "Trading Analytics",
        headline: "Tu portafolio, claro y al día.",
        subtitle:
          "Sigue el rendimiento, el riesgo y la distribución de tus inversiones en un solo lugar.",
      },
      email: "Correo electrónico",
      emailPlaceholder: "nombre@correo.com",
      passwordPlaceholder: "Tu contraseña",
      password: "Contraseña",
      showPassword: "Mostrar contraseña",
      hidePassword: "Ocultar contraseña",
      emailInvalid: "Ingresa un correo válido",
      passwordRequired: "Ingresa tu contraseña",
      submit: "Iniciar sesión",
      submitting: "Iniciando sesión…",
      or: "o",
      enterDemo: "Entrar a la demo",
      enteringDemo: "Entrando…",
      demoNote: "Sin credenciales · usa datos ficticios",
      retry: "Reintentar",
      offline: {
        title: "Sin conexión",
        description: "Revisa tu conexión a internet para iniciar sesión.",
      },
      failure: {
        credentials: {
          title: "Correo o contraseña incorrectos",
          description: "Revisa tus datos e inténtalo de nuevo.",
        },
        "rate-limited": {
          title: "Demasiados intentos",
          description: "Espera unos minutos antes de volver a intentarlo.",
        },
        unavailable: {
          title: "Servicio no disponible",
          description: "No pudimos conectar con el servidor. Inténtalo de nuevo en unos minutos.",
        },
      },
    },
  },
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
