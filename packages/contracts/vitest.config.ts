import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["@trading/source"] },
  ssr: { resolve: { conditions: ["@trading/source"], externalConditions: ["@trading/source"] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    watch: false,
  },
});
