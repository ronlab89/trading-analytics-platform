import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { env } from "./config/env";
import "./i18n";
import "./index.css";
import { trackInputModality } from "./lib/input-modality";
import { logger } from "./lib/logging/logger";

logger.info("app.started", { mode: env.VITE_APP_MODE });
trackInputModality();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
