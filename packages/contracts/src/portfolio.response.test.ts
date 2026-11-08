import { describe, expect, it } from "vitest";
import type { Portfolio } from "@trading/domain";
import {
  archivePortfolioResponseSchema,
  portfolioResponseSchema,
  presentPortfolio,
} from "./portfolio.response.js";

const entity: Portfolio = {
  id: "p1",
  userId: "u1",
  name: "Main",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  updatedAt: new Date("2026-10-14T12:00:00.000Z"),
};

describe("portfolio presenter", () => {
  it("serializes exactly what the API returned before", () => {
    const dto = presentPortfolio(entity);
    expect(dto).toEqual(JSON.parse(JSON.stringify(entity)));
    expect(portfolioResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentPortfolio({ ...entity, extra: 1 } as Portfolio);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "baseCurrency",
        "createdAt",
        "description",
        "id",
        "name",
        "status",
        "updatedAt",
        "userId",
      ].sort(),
    );
  });

  it("describes the archive response with its alreadyArchived meta", () => {
    const body = { data: presentPortfolio(entity), meta: { alreadyArchived: true } };
    expect(archivePortfolioResponseSchema.safeParse(body).success).toBe(true);
    expect(archivePortfolioResponseSchema.safeParse({ data: body.data }).success).toBe(false);
  });
});
