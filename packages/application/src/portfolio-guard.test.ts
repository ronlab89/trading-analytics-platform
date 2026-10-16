import { describe, expect, it } from "vitest";
import { PortfolioStatus } from "@trading/domain";
import { ConflictError } from "./errors.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";

describe("assertPortfolioWritable", () => {
  it("accepts an active portfolio", () => {
    expect(() => {
      assertPortfolioWritable({ status: PortfolioStatus.ACTIVE });
    }).not.toThrow();
  });

  it("rejects an archived portfolio with a conflict", () => {
    const error = (() => {
      try {
        assertPortfolioWritable({ status: PortfolioStatus.ARCHIVED });
      } catch (e) {
        return e;
      }
      return undefined;
    })();

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("An archived portfolio cannot be modified.");
  });
});
