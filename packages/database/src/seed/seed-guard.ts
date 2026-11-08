/**
 * Destructive database operations (seed wipe, hard reset) must never run
 * against a production environment.
 */
export function assertNotProduction(
  operation: string,
  env: { NODE_ENV?: string | undefined } = process.env,
): void {
  if (env.NODE_ENV === "production") {
    throw new Error(`Refusing to run "${operation}" while NODE_ENV=production.`);
  }
}
