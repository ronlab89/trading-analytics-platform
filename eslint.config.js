// @ts-check
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/generated/**",
    ],
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
    },
  },

  // Architectural import boundaries (06-architecture.md §43, ADR-001 point 1).
  // Tests may import their runner and helpers, so the boundaries cover source files only.
  {
    // @trading/application imports nothing except @trading/domain (and its own files).
    files: ["packages/application/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!@trading/domain$|\\.{1,2}/).+",
              message:
                "@trading/application may only import @trading/domain: no Prisma, Express, Zod, @trading/contracts or other packages (ADR-001 point 1).",
            },
          ],
        },
      ],
    },
  },

  {
    // @trading/persistence-memory imports nothing except @trading/domain (and its own files).
    // The contract suites under src/contract are test code and import vitest.
    files: ["packages/persistence-memory/src/**/*.ts"],
    ignores: ["**/*.test.ts", "packages/persistence-memory/src/contract/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(?!@trading/domain$|\\.{1,2}/).+",
              message:
                "@trading/persistence-memory may only import @trading/domain: no Prisma, Express, Zod, @trading/application or other packages (ADR-001 point 1).",
            },
          ],
        },
      ],
    },
  },

  {
    // Config files and repository scripts live outside any tsconfig `include`, so type-aware rules
    // (which require project membership) must be disabled for them.
    // This is typescript-eslint's documented pattern for root-level config files.
    files: ["*.config.js", "*.config.mjs", "*.config.cjs", "**/*.config.ts", "scripts/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier must always be last: disables ESLint rules that conflict with formatting
  eslintConfigPrettier,
];
