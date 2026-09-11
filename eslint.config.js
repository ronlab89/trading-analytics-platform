// @ts-check
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Enforced project-wide: no implicit any, no unsafe casts (04-tech-stack.md NFR-038)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",

      // Placeholder for future architectural import boundaries
      // (06-architecture.md §43 — domain must not import React/Prisma/etc.)
      // Activated once apps/packages contain real code:
      // "no-restricted-imports": ["error", { patterns: [...] }],
    },
  },

  {
    // Config files live outside any tsconfig `include`, so type-aware rules
    // (which require project membership) must be disabled for them.
    // This is typescript-eslint's documented pattern for root-level config files.
    files: ["*.config.js", "*.config.mjs", "*.config.cjs", "**/*.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier must always be last: disables ESLint rules that conflict with formatting
  eslintConfigPrettier,
];
