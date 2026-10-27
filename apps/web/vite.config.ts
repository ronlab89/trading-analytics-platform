import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Workspace packages expose their TypeScript source under this condition.
    conditions: ["@trading/source", ...defaultClientConditions],
    tsconfigPaths: true,
  },
});
