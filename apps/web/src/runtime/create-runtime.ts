import type { AppRuntime } from "./app-runtime";

/**
 * Picks the adapters by the build flag. `__DEMO_BUILD__` is replaced by a literal at build time, so
 * the branch that is not taken, and the modules it imports, never reach the bundle (ADR-012 point 9).
 */
export async function createRuntime(): Promise<AppRuntime> {
  if (__DEMO_BUILD__) {
    const { createDemoRuntime } = await import("@/demo/create-demo-runtime");
    return createDemoRuntime();
  }
  const { createHttpRuntime } = await import("./create-http-runtime");
  return createHttpRuntime();
}
