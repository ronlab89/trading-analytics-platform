import type { UserRole } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError } from "./errors.js";

/**
 * Permission mechanism.
 * Source: ADR-005 points 2 and 3.
 *
 * Code checks permissions, never role names. Roles are sets of
 * permissions. The matrix below is the real one (`09-security-spec.md`
 * §12-13): VIEWER reads own resources and updates its own preferences and
 * notifications, TRADER has every supported mutation on own resources, and
 * ADMIN is TRADER plus `simulation:control`.
 */
export const PERMISSIONS = [
  "alert:read",
  "alert:write",
  "analytics:read",
  "asset:read",
  "decision:read",
  "market:read",
  "notification:read",
  "notification:write",
  "overview:read",
  "portfolio:read",
  "portfolio:write",
  "position:read",
  "preference:read",
  "preference:write",
  "scenario:read",
  "scenario:write",
  "simulation:control",
  "transaction:create",
  "transaction:read",
  "watchlist:read",
  "watchlist:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RolePermissions = Readonly<Record<UserRole, ReadonlySet<Permission>>>;

const VIEWER_PERMISSIONS: readonly Permission[] = [
  "alert:read",
  "analytics:read",
  "asset:read",
  "decision:read",
  "market:read",
  "notification:read",
  "notification:write",
  "overview:read",
  "portfolio:read",
  "position:read",
  "preference:read",
  "preference:write",
  "scenario:read",
  "transaction:read",
  "watchlist:read",
];

export const ROLE_PERMISSIONS: RolePermissions = {
  VIEWER: new Set(VIEWER_PERMISSIONS),
  TRADER: new Set(PERMISSIONS.filter((permission) => permission !== "simulation:control")),
  ADMIN: new Set(PERMISSIONS),
};

export function hasPermission(
  actor: Actor,
  permission: Permission,
  matrix: RolePermissions = ROLE_PERMISSIONS,
): boolean {
  return matrix[actor.role].has(permission);
}

/** Throws `ForbiddenError` when the actor's role lacks the permission. */
export function assertPermission(
  actor: Actor,
  permission: Permission,
  matrix: RolePermissions = ROLE_PERMISSIONS,
): void {
  if (!hasPermission(actor, permission, matrix)) {
    throw new ForbiddenError(`Missing permission: ${permission}.`);
  }
}
