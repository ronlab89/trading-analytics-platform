import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Position, PositionRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createPositionService } from "./position-service.js";

const actor: Actor = { userId: "u1", role: "USER" };

function position(id: string, portfolioId: string): Position {
  return {
    id,
    portfolioId,
    assetId: "a1",
    quantity: 10,
    averageEntryPrice: Money.of("100", "USD"),
    currentPrice: Money.of("110", "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
}

function build(positions: Position[], ownedPortfolios: string[] = ["p1"]) {
  const positionRepository: Pick<PositionRepository, "listByPortfolioId" | "getById"> = {
    listByPortfolioId: (portfolioId) =>
      Promise.resolve(positions.filter((p) => p.portfolioId === portfolioId)),
    getById: (id) => Promise.resolve(positions.find((p) => p.id === id) ?? null),
  };
  const portfolioService = {
    getPortfolioById: (_actor: Actor, portfolioId: string) =>
      ownedPortfolios.includes(portfolioId)
        ? Promise.resolve({})
        : Promise.reject(new NotFoundError("The requested resource could not be found.")),
  };
  return createPositionService({
    positionRepository,
    portfolioService: portfolioService as never,
  });
}

describe("position service", () => {
  it("lists the positions of an owned portfolio", async () => {
    const service = build([position("x1", "p1"), position("x2", "p2")]);
    const result = await service.listPositions(actor, "p1");
    expect(result.map((p) => p.id)).toEqual(["x1"]);
  });

  it("does not list positions of a portfolio the actor does not own", async () => {
    const service = build([position("x1", "p2")], []);
    await expect(service.listPositions(actor, "p2")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a position with its derived metrics", async () => {
    const service = build([position("x1", "p1")]);
    const detail = await service.getPositionById(actor, "p1", "x1");
    expect(detail.position.id).toBe("x1");
    expect(detail.metrics).toBeDefined();
  });

  it("raises NotFoundError for a position that belongs to another portfolio", async () => {
    const service = build([position("x1", "p2")], ["p1", "p2"]);
    const error = await service.getPositionById(actor, "p1", "x1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("raises NotFoundError for an unknown position", async () => {
    const service = build([]);
    await expect(service.getPositionById(actor, "p1", "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("needs position:read for every use case", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "position:read")),
      ADMIN: new Set(PERMISSIONS),
    };
    const service = createPositionService({
      positionRepository: {
        listByPortfolioId: () => Promise.resolve([]),
        getById: () => Promise.resolve(null),
      },
      portfolioService: { getPortfolioById: () => Promise.resolve({}) } as never,
      permissions: noRead,
    });
    await expect(service.listPositions(actor, "p1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.getPositionById(actor, "p1", "x1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
