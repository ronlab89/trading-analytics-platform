import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";

// The matcher packages augment `vitest` from inside their own pnpm node_modules,
// where `vitest` does not resolve, so the augmentation is declared here instead.
declare module "vitest" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T>, AxeMatchers {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown>, AxeMatchers {}
}
