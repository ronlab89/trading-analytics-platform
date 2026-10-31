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
      expired: {
        title: "Your session expired",
        description: "For your security, sign in again to continue.",
      },
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
  dataTable: {
    pagination: "Pagination",
    showing: "Showing {{from}}–{{to}} of {{total}}",
    page: "Page {{page}} of {{pageCount}}",
    previousPage: "Previous page",
    nextPage: "Next page",
  },
  dialog: { close: "Close" },
  portfolioForm: {
    title: "New portfolio",
    subtitle: "Group your positions and transactions in an independent portfolio.",
    mobile: {
      title: "Create portfolio",
      subtitle: "Group your positions and choose their base currency.",
    },
    cancel: "Cancel",
    submit: "Create portfolio",
    submitting: "Creating…",
    discard: {
      title: "Leave without saving?",
      description: "The portfolio you’re creating will be discarded. This can’t be undone.",
      keepEditing: "Keep editing",
      confirm: "Leave without saving",
    },
    created: { title: "Portfolio created", description: "“{{name}}” is now in your list." },
    createFailed: {
      title: "Couldn't create the portfolio",
      description: "Check your connection and try again. Nothing was created.",
    },
    name: { label: "Name", placeholder: "e.g. Long term", required: "Enter a name" },
    description: {
      label: "Description",
      placeholder: "e.g. Long-term investment portfolio",
      optional: "Optional",
    },
    baseCurrency: {
      label: "Base currency",
      placeholder: "Select a currency",
      help: "You won't be able to change it after creating it.",
      locked: "The base currency can’t be changed.",
      required: "Select a base currency.",
      options: {
        USD: "USD · US dollar",
        EUR: "EUR · Euro",
        GBP: "GBP · Pound sterling",
        COP: "COP · Colombian peso",
      },
    },
  },
  portfolioArchive: {
    title: "Archive portfolio?",
    description:
      "“{{name}}” will stop being active and you won’t be able to edit it. This can’t be undone.",
    confirm: "Archive",
    archiving: "Archiving…",
    archived: { title: "Portfolio archived", description: "“{{name}}” moved to archived." },
    failed: {
      title: "Couldn't archive the portfolio",
      description: "Check your connection and try again. Nothing was changed.",
    },
  },
  portfolioEdit: {
    title: "Edit portfolio",
    subtitle: "Change the name of your portfolio.",
    mobileSubtitle: "Change the name or the description.",
    submit: "Save changes",
    submitting: "Saving…",
    discardDescription:
      "The changes you made to this portfolio will be lost. This can’t be undone.",
    saved: { title: "Portfolio updated", description: "“{{name}}” was saved." },
    saveFailed: {
      title: "Couldn't save the portfolio",
      description: "Check your connection and try again. Nothing was changed.",
    },
  },
  portfolios: {
    summary_one: "Manage your portfolios · {{count}} in total",
    summary_other: "Manage your portfolios · {{count}} in total",
    new: "New portfolio",
    newShort: "New",
    mobile: {
      empty: {
        title: "There are no portfolios yet",
        description: "Create your first portfolio to start recording transactions.",
      },
      failed: {
        title: "We couldn't load the portfolios",
        description: "There was a problem connecting to the server. Try again in a few seconds.",
      },
    },
    table: "Portfolios",
    loading: "Loading portfolios",
    empty: {
      title: "You have no portfolios yet",
      description: "Create your first portfolio to record positions and transactions.",
      action: "Create portfolio",
    },
    noResults: {
      title: "No results",
      description: "No portfolio matches “{{query}}”. Check the name or clear the search.",
      clear: "Clear search",
    },
    failed: {
      title: "Couldn't load the portfolios",
      description: "Check your connection and try again. Your data has not been changed.",
      retry: "Retry",
    },
    search: "Search portfolio",
    count_one: "{{count}} portfolio",
    count_other: "{{count}} portfolios",
    columns: { name: "Name", baseCurrency: "Base currency", status: "Status", actions: "Actions" },
    status: { ACTIVE: "Active", ARCHIVED: "Archived" },
    inUse: "In use",
    rowMenu: {
      label: "Actions for “{{name}}”",
      use: "Use this portfolio",
      edit: "Edit",
      archive: "Archive",
    },
  },
  portfolioDetail: {
    back: "Back to Portfolios",
    menu: { label: "Portfolio actions" },
    failed: {
      title: "Couldn't load the portfolio",
      description: "Check your connection and try again. Your data has not been changed.",
      retry: "Retry",
    },
    positions: {
      title: "Positions",
      table: "Positions",
      loading: "Loading positions",
      unknownAsset: "Unknown asset",
      mobile: { summary: "{{quantity}} units · Avg. {{average}} · Current {{current}}" },
      columns: {
        asset: "Asset",
        quantity: "Quantity",
        averageEntryPrice: "Avg. price",
        currentPrice: "Current price",
      },
      count_one: "{{count}} position",
      count_other: "{{count}} positions",
      empty: {
        title: "No positions",
        description: "Record a buy transaction to add the first position of this portfolio.",
      },
      failed: {
        title: "Couldn't load the positions",
        description: "Check your connection and try again. Your data has not been changed.",
        retry: "Retry",
      },
    },
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
    loadingPortfolios: "Loading portfolios",
    noPortfolios: "No portfolios",
    portfoliosFailed: "Couldn't load portfolios",
    retryPortfolios: "Couldn't load portfolios. Retry",
    demoData: "Demo data",
    demoControls: "Demo controls",
    simulateConnectionIssue: "Simulate a connection problem",
    sendTestNotification: "Send a test notification",
    resetDemo: "Reset demo",
    notifications: "Notifications",
    messages: "Messages",
    signOutFailed: {
      title: "Could not sign out",
      description: "You are still signed in. Check your connection and try again.",
    },
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
      expired: {
        title: "Tu sesión expiró",
        description: "Por seguridad, vuelve a iniciar sesión para continuar.",
      },
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
  dataTable: {
    pagination: "Paginación",
    showing: "Mostrando {{from}}–{{to}} de {{total}}",
    page: "Página {{page}} de {{pageCount}}",
    previousPage: "Página anterior",
    nextPage: "Página siguiente",
  },
  dialog: { close: "Cerrar" },
  portfolioForm: {
    title: "Nuevo portafolio",
    subtitle: "Agrupa tus posiciones y transacciones en un portafolio independiente.",
    mobile: {
      title: "Crear portafolio",
      subtitle: "Agrupa tus posiciones y elige su moneda base.",
    },
    cancel: "Cancelar",
    submit: "Crear portafolio",
    submitting: "Creando…",
    discard: {
      title: "¿Salir sin guardar?",
      description:
        "Se descartará el portafolio que estás creando. Esta acción no se puede deshacer.",
      keepEditing: "Seguir editando",
      confirm: "Salir sin guardar",
    },
    created: {
      title: "Portafolio creado",
      description: "«{{name}}» ya está disponible en tu lista.",
    },
    createFailed: {
      title: "No se pudo crear el portafolio",
      description: "Revisa tu conexión e inténtalo de nuevo. No se creó nada.",
    },
    name: { label: "Nombre", placeholder: "Ej. Largo plazo", required: "Ingresa un nombre" },
    description: {
      label: "Descripción",
      placeholder: "Ej. Cartera de inversión a largo plazo",
      optional: "Opcional",
    },
    baseCurrency: {
      label: "Moneda base",
      placeholder: "Selecciona una moneda",
      help: "No podrás cambiarla después de crearlo.",
      locked: "La moneda base no se puede cambiar.",
      required: "Selecciona una moneda base.",
      options: {
        USD: "USD · Dólar estadounidense",
        EUR: "EUR · Euro",
        GBP: "GBP · Libra esterlina",
        COP: "COP · Peso colombiano",
      },
    },
  },
  portfolioArchive: {
    title: "¿Archivar portafolio?",
    description:
      "«{{name}}» dejará de estar activo y no podrás editarlo. Esta acción no se puede deshacer.",
    confirm: "Archivar",
    archiving: "Archivando…",
    archived: { title: "Portafolio archivado", description: "«{{name}}» pasó a archivados." },
    failed: {
      title: "No se pudo archivar el portafolio",
      description: "Revisa tu conexión e inténtalo de nuevo. No se cambió nada.",
    },
  },
  portfolioEdit: {
    title: "Editar portafolio",
    subtitle: "Cambia el nombre de tu portafolio.",
    mobileSubtitle: "Cambia el nombre o la descripción.",
    submit: "Guardar cambios",
    submitting: "Guardando…",
    discardDescription:
      "Se perderán los cambios que hiciste en este portafolio. Esta acción no se puede deshacer.",
    saved: { title: "Portafolio actualizado", description: "«{{name}}» se guardó." },
    saveFailed: {
      title: "No se pudo guardar el portafolio",
      description: "Revisa tu conexión e inténtalo de nuevo. No se cambió nada.",
    },
  },
  portfolios: {
    summary_one: "Administra tus portafolios · {{count}} en total",
    summary_other: "Administra tus portafolios · {{count}} en total",
    new: "Nuevo portafolio",
    newShort: "Nuevo",
    mobile: {
      empty: {
        title: "Aún no hay portafolios",
        description: "Crea tu primer portafolio para empezar a registrar transacciones.",
      },
      failed: {
        title: "No pudimos cargar los portafolios",
        description:
          "Hubo un problema al conectar con el servidor. Inténtalo de nuevo en unos segundos.",
      },
    },
    table: "Portafolios",
    loading: "Cargando portafolios",
    empty: {
      title: "Aún no tienes portafolios",
      description: "Crea tu primer portafolio para registrar posiciones y transacciones.",
      action: "Crear portafolio",
    },
    noResults: {
      title: "Sin resultados",
      description:
        "No hay portafolios que coincidan con «{{query}}». Revisa el nombre o limpia la búsqueda.",
      clear: "Limpiar búsqueda",
    },
    failed: {
      title: "No se pudieron cargar los portafolios",
      description: "Revisa tu conexión e inténtalo de nuevo. Tus datos no se han modificado.",
      retry: "Reintentar",
    },
    search: "Buscar portafolio",
    count_one: "{{count}} portafolio",
    count_other: "{{count}} portafolios",
    columns: { name: "Nombre", baseCurrency: "Moneda base", status: "Estado", actions: "Acciones" },
    status: { ACTIVE: "Activo", ARCHIVED: "Archivado" },
    inUse: "En uso",
    rowMenu: {
      label: "Acciones de «{{name}}»",
      use: "Usar este portafolio",
      edit: "Editar",
      archive: "Archivar",
    },
  },
  portfolioDetail: {
    back: "Volver a Portafolios",
    menu: { label: "Acciones del portafolio" },
    failed: {
      title: "No se pudo cargar el portafolio",
      description: "Revisa tu conexión e inténtalo de nuevo. Tus datos no se han modificado.",
      retry: "Reintentar",
    },
    positions: {
      title: "Posiciones",
      table: "Posiciones",
      loading: "Cargando posiciones",
      unknownAsset: "Activo desconocido",
      mobile: { summary: "{{quantity}} uds. · Prom. {{average}} · Actual {{current}}" },
      columns: {
        asset: "Activo",
        quantity: "Cantidad",
        averageEntryPrice: "Precio prom.",
        currentPrice: "Precio actual",
      },
      count_one: "{{count}} posición",
      count_other: "{{count}} posiciones",
      empty: {
        title: "Sin posiciones",
        description:
          "Registra una transacción de compra para añadir la primera posición de este portafolio.",
      },
      failed: {
        title: "No se pudieron cargar las posiciones",
        description: "Revisa tu conexión e inténtalo de nuevo. Tus datos no se han modificado.",
        retry: "Reintentar",
      },
    },
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
    loadingPortfolios: "Cargando portafolios",
    noPortfolios: "Sin portafolios",
    portfoliosFailed: "No se pudieron cargar los portafolios",
    retryPortfolios: "No se pudieron cargar los portafolios. Reintentar",
    demoData: "Datos demo",
    demoControls: "Controles de la demo",
    simulateConnectionIssue: "Simular problema de conexión",
    sendTestNotification: "Enviar notificación de prueba",
    resetDemo: "Restablecer demo",
    notifications: "Notificaciones",
    messages: "Mensajes",
    signOutFailed: {
      title: "No se pudo cerrar la sesión",
      description: "Seguís con la sesión iniciada. Revisá tu conexión e intentá de nuevo.",
    },
    notificationsUnread_one: "Notificaciones, {{count}} sin leer",
    notificationsUnread_other: "Notificaciones, {{count}} sin leer",
  },
};

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;
