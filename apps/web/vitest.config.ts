import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["@trading/source"] },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    watch: false,
  },
});
