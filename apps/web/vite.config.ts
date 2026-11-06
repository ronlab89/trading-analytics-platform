import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // The demo is a separate static build (ADR-012 point 9). `__DEMO_BUILD__` is replaced by a
  // literal, so in the real build the demo branches are removed and their code never ships.
  const demo = loadEnv(mode, process.cwd(), "VITE_").VITE_APP_MODE === "demo";
  return {
    define: { __DEMO_BUILD__: JSON.stringify(demo) },
    plugins: [react(), tailwindcss()],
    resolve: {
      // Workspace packages expose their TypeScript source under this condition.
      conditions: ["@trading/source", ...defaultClientConditions],
      tsconfigPaths: true,
    },
  };
});
