import type { UserRole } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError } from "./errors.js";

/**
 * Permission mechanism.
 * Source: ADR-005 points 2 and 3.
 *
 * Code checks permissions, never role names. Roles are sets of
 * permissions. B0.5 builds the mechanism and grants every permission to
 * every current role, so no behavior changes; B2 fills in the real matrix
 * (`09-security-spec.md`).
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
  "transaction:create",
  "transaction:read",
  "watchlist:read",
  "watchlist:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RolePermissions = Readonly<Record<UserRole, ReadonlySet<Permission>>>;

export const ROLE_PERMISSIONS: RolePermissions = {
  USER: new Set(PERMISSIONS),
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
