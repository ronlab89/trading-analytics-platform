import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Asset, Portfolio, Position } from "@trading/domain";
import type { Actor } from "./actor.js";
import { createAnalyticsService } from "./analytics-service.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "TRADER" };

const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

function asset(id: string, symbol: string, assetType: Asset["assetType"]): Asset {
  return {
    id,
    symbol,
    name: `Name ${symbol}`,
    assetType,
    currency: "USD",
    exchange: "MOCK",
    status: "ACTIVE",
    metadata: {},
  };
}

function position(id: string, assetId: string, quantity: number, current: string): Position {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity,
    averageEntryPrice: Money.of("100", "USD"),
    currentPrice: Money.of(current, "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };
}

const assets = [asset("a1", "AAA", "STOCK"), asset("a2", "BBB", "CRYPTO")];
const positions = [position("x1", "a1", 1, "300"), position("x2", "a2", 1, "100")];

function build(options: { owned?: boolean; permissions?: RolePermissions } = {}) {
  const { owned = true, permissions } = options;
  return createAnalyticsService({
    positionRepository: { listByPortfolioId: () => Promise.resolve(positions) },
    portfolioService: {
      getPortfolioById: () =>
        owned
          ? Promise.resolve(portfolio)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    assetService: {
      getAssetsByIds: (_actor, ids) =>
        Promise.resolve(new Map(assets.filter((a) => ids.includes(a.id)).map((a) => [a.id, a]))),
    },
    ...(permissions ? { permissions } : {}),
  });
}

describe("analytics service", () => {
  it("groups allocation by asset, labelled with the symbol", async () => {
    const result = await build().getPortfolioAllocation(actor, "p1", "asset");
    expect(result.groupBy).toBe("asset");
    expect(result.groups.map((g) => [g.key, g.label])).toEqual([
      ["a1", "AAA"],
      ["a2", "BBB"],
    ]);
    expect(result.groups.map((g) => g.percentage)).toEqual([75, 25]);
  });

  it("groups allocation by asset type", async () => {
    const result = await build().getPortfolioAllocation(actor, "p1", "assetType");
    expect(result.groups.map((g) => g.key).sort()).toEqual(["CRYPTO", "STOCK"]);
  });

  it("returns attribution with symbol, name and the total unrealized P/L", async () => {
    const result = await build().getPortfolioAttribution(actor, "p1");
    expect(result.totalUnrealizedPnL.equals(Money.of("200", "USD"))).toBe(true);
    const first = result.items.find((i) => i.assetId === "a1");
    expect(first?.symbol).toBe("AAA");
    expect(first?.name).toBe("Name AAA");
  });

  it("raises NotFoundError for a portfolio the actor does not own", async () => {
    const service = build({ owned: false });
    await expect(service.getPortfolioAllocation(actor, "p1", "asset")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service.getPortfolioAttribution(actor, "p1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("needs analytics:read for every use case", async () => {
    const noRead: RolePermissions = {
      TRADER: new Set(PERMISSIONS.filter((p) => p !== "analytics:read")),
      VIEWER: new Set(PERMISSIONS),
      ADMIN: new Set(PERMISSIONS),
    };
    const service = build({ permissions: noRead });
    await expect(service.getPortfolioAllocation(actor, "p1", "asset")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(service.getPortfolioAttribution(actor, "p1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
