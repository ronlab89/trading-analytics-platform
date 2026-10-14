import { describe, expect, it } from "vitest";
import type { Actor } from "./actor.js";
import { ForbiddenError } from "./errors.js";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  assertPermission,
  hasPermission,
  type RolePermissions,
} from "./permissions.js";

const user: Actor = { userId: "u1", role: "USER" };
const admin: Actor = { userId: "u2", role: "ADMIN" };

describe("permissions", () => {
  it("B0.5 grants every permission to every current role, so behavior is unchanged", () => {
    for (const actor of [user, admin]) {
      for (const permission of PERMISSIONS) {
        expect(hasPermission(actor, permission)).toBe(true);
        expect(() => {
          assertPermission(actor, permission);
        }).not.toThrow();
      }
    }
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["ADMIN", "USER"]);
  });

  it("names the ADR-005 examples", () => {
    expect(PERMISSIONS).toContain("portfolio:read");
    expect(PERMISSIONS).toContain("transaction:create");
  });

  describe("with a restricted matrix (what B2 will fill in)", () => {
    const matrix: RolePermissions = {
      USER: new Set(["portfolio:read"]),
      ADMIN: new Set(PERMISSIONS),
    };

    it("allows a granted permission and denies the rest", () => {
      expect(hasPermission(user, "portfolio:read", matrix)).toBe(true);
      expect(hasPermission(user, "transaction:create", matrix)).toBe(false);
      expect(hasPermission(admin, "transaction:create", matrix)).toBe(true);
    });

    it("assertPermission throws ForbiddenError naming the permission", () => {
      expect(() => {
        assertPermission(user, "transaction:create", matrix);
      }).toThrow(ForbiddenError);
      expect(() => {
        assertPermission(user, "transaction:create", matrix);
      }).toThrow("transaction:create");
    });
  });
});
