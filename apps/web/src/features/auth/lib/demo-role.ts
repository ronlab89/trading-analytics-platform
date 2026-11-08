export const DEMO_ROLES = ["VIEWER", "TRADER", "ADMIN"] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEFAULT_DEMO_ROLE: DemoRole = "TRADER";

/** The demo keeps only a small record of choices under this prefix (ADR-012 point 2). */
export const DEMO_ROLE_STORAGE_KEY = "trading-demo:role";

/** The email the demo sign in sends: its name tells the demo which role to give. */
export function demoEmailFor(role: DemoRole): string {
  return `${role.toLowerCase()}@demo.example`;
}

export function readDemoRole(storage: Pick<Storage, "getItem"> = localStorage): DemoRole {
  const stored = storage.getItem(DEMO_ROLE_STORAGE_KEY);
  return DEMO_ROLES.find((role) => role === stored) ?? DEFAULT_DEMO_ROLE;
}

export function saveDemoRole(role: DemoRole, storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(DEMO_ROLE_STORAGE_KEY, role);
}
