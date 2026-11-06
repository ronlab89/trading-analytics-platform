interface ImportMetaEnv {
  readonly VITE_APP_MODE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_DEMO_LATENCY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** True only in the demo build; replaced by a literal at build time (see vite.config.ts). */
declare const __DEMO_BUILD__: boolean;
