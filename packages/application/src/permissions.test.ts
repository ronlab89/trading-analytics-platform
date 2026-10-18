import { describe, expect, it } from "vitest";
import type { UserRole } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError } from "./errors.js";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  assertPermission,
  hasPermission,
  type Permission,
  type RolePermissions,
} from "./permissions.js";

const viewer: Actor = { userId: "u1", role: "VIEWER" };
const trader: Actor = { userId: "u2", role: "TRADER" };
const admin: Actor = { userId: "u3", role: "ADMIN" };

const VIEWER_DENIED: readonly Permission[] = [
  "alert:write",
  "portfolio:write",
  "scenario:write",
  "simulation:control",
  "transaction:create",
  "watchlist:write",
];

const DENIED: Record<UserRole, readonly Permission[]> = {
  VIEWER: VIEWER_DENIED,
  TRADER: ["simulation:control"],
  ADMIN: [],
};

const ACTORS: Record<UserRole, Actor> = { VIEWER: viewer, TRADER: trader, ADMIN: admin };

describe("permissions", () => {
  it("defines exactly the roles VIEWER, TRADER and ADMIN", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["ADMIN", "TRADER", "VIEWER"]);
  });

  it("names the ADR-005 examples and simulation:control", () => {
    expect(PERMISSIONS).toContain("portfolio:read");
    expect(PERMISSIONS).toContain("transaction:create");
    expect(PERMISSIONS).toContain("simulation:control");
  });

  describe.each(Object.keys(ACTORS) as UserRole[])("the %s matrix", (role) => {
    const actor = ACTORS[role];

    it.each(PERMISSIONS)("%s", (permission) => {
      const denied = DENIED[role].includes(permission);

      expect(hasPermission(actor, permission)).toBe(!denied);
      if (denied) {
        expect(() => {
          assertPermission(actor, permission);
        }).toThrow(ForbiddenError);
      } else {
        expect(() => {
          assertPermission(actor, permission);
        }).not.toThrow();
      }
    });
  });

  it("VIEWER may read everything and only update its own preferences and notifications", () => {
    const writes = PERMISSIONS.filter(
      (permission) => !permission.endsWith(":read") && hasPermission(viewer, permission),
    );

    expect(writes.sort()).toEqual(["notification:write", "preference:write"]);
    for (const permission of PERMISSIONS.filter((p) => p.endsWith(":read"))) {
      expect(hasPermission(viewer, permission)).toBe(true);
    }
  });

  it("ADMIN is TRADER plus simulation:control and nothing else", () => {
    const extra = [...ROLE_PERMISSIONS.ADMIN].filter(
      (permission) => !ROLE_PERMISSIONS.TRADER.has(permission),
    );

    expect(extra).toEqual(["simulation:control"]);
  });

  describe("with a restricted matrix", () => {
    const matrix: RolePermissions = {
      VIEWER: new Set(["portfolio:read"]),
      TRADER: new Set(["portfolio:read"]),
      ADMIN: new Set(PERMISSIONS),
    };

    it("allows a granted permission and denies the rest", () => {
      expect(hasPermission(trader, "portfolio:read", matrix)).toBe(true);
      expect(hasPermission(trader, "transaction:create", matrix)).toBe(false);
      expect(hasPermission(admin, "transaction:create", matrix)).toBe(true);
    });

    it("assertPermission throws ForbiddenError naming the permission", () => {
      expect(() => {
        assertPermission(trader, "transaction:create", matrix);
      }).toThrow(ForbiddenError);
      expect(() => {
        assertPermission(trader, "transaction:create", matrix);
      }).toThrow("transaction:create");
    });
  });
});
