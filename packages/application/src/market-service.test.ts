import { describe, expect, it, vi } from "vitest";
import { Money } from "@trading/domain";
import type {
  Asset,
  AssetRepository,
  HistoricalPrice,
  HistoricalPriceRepository,
  MarketPrice,
  MarketPriceRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { createMarketService } from "./market-service.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "TRADER" };
const usd = (amount: string): Money => Money.of(amount, "USD");

const asset = { id: "a1" } as Asset;
const price: MarketPrice = {
  assetId: "a1",
  price: usd("110"),
  previousPrice: usd("100"),
  change: usd("10"),
  changePercent: 10,
  timestamp: new Date("2026-10-13T12:00:00.000Z"),
  source: "MOCK",
};
const candle: HistoricalPrice = {
  assetId: "a1",
  timestamp: new Date("2026-10-12T00:00:00.000Z"),
  open: usd("100"),
  high: usd("111"),
  low: usd("99"),
  close: usd("110"),
  volume: 10,
};

function build(permissions?: RolePermissions) {
  const listByAssetIds = vi.fn((ids: string[]) =>
    Promise.resolve(ids.includes("a1") ? [price] : []),
  );
  const listByAssetId = vi.fn((_id: string, _from: Date, _to: Date) => Promise.resolve([candle]));
  const assetRepository: Pick<AssetRepository, "getById"> = {
    getById: (id) => Promise.resolve(id === "a1" ? asset : null),
  };
  const marketPriceRepository: Pick<MarketPriceRepository, "getByAssetId" | "listByAssetIds"> = {
    getByAssetId: (id) => Promise.resolve(id === "a1" ? price : null),
    listByAssetIds,
  };
  const historicalPriceRepository: Pick<HistoricalPriceRepository, "listByAssetId"> = {
    listByAssetId,
  };
  const service = createMarketService({
    assetRepository,
    marketPriceRepository,
    historicalPriceRepository,
    ...(permissions ? { permissions } : {}),
  });
  return { service, listByAssetIds, listByAssetId };
}

describe("market service", () => {
  describe("getAssetPrice", () => {
    it("returns the current price", async () => {
      expect((await build().service.getAssetPrice(actor, "a1")).changePercent).toBe(10);
    });

    it("distinguishes an unknown asset from an asset without a price", async () => {
      const { service } = build();
      const unknown = await service.getAssetPrice(actor, "nope").catch((e: unknown) => e);
      expect(unknown).toBeInstanceOf(NotFoundError);
      expect((unknown as Error).message).toBe("The requested asset could not be found.");
    });

    it("says so when the asset exists but has no current price", async () => {
      const service = createMarketService({
        assetRepository: { getById: () => Promise.resolve(asset) },
        marketPriceRepository: {
          getByAssetId: () => Promise.resolve(null),
          listByAssetIds: () => Promise.resolve([]),
        },
        historicalPriceRepository: { listByAssetId: () => Promise.resolve([]) },
      });
      const error = await service.getAssetPrice(actor, "a1").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as Error).message).toBe("No current price is available for this asset.");
    });
  });

  describe("getBatchPrices", () => {
    it("omits unknown ids instead of failing", async () => {
      const { service, listByAssetIds } = build();
      expect(await service.getBatchPrices(actor, ["a1", "ghost"])).toEqual([price]);
      expect(await service.getBatchPrices(actor, ["ghost"])).toEqual([]);
      expect(listByAssetIds).toHaveBeenCalledWith(["a1", "ghost"]);
    });
  });

  describe("getAssetHistory", () => {
    it("returns candles for the range after checking the asset exists", async () => {
      const { service, listByAssetId } = build();
      const from = new Date("2026-10-01T00:00:00.000Z");
      const to = new Date("2026-10-13T00:00:00.000Z");
      expect(await service.getAssetHistory(actor, "a1", from, to)).toEqual([candle]);
      expect(listByAssetId).toHaveBeenCalledWith("a1", from, to);
    });

    it("fails with NotFoundError before reading candles for an unknown asset", async () => {
      const { service, listByAssetId } = build();
      await expect(
        service.getAssetHistory(actor, "nope", new Date(0), new Date(1)),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(listByAssetId).not.toHaveBeenCalled();
    });
  });

  it("needs market:read for every use case", async () => {
    const denied: RolePermissions = {
      TRADER: new Set(PERMISSIONS.filter((p) => p !== "market:read")),
      VIEWER: new Set(PERMISSIONS),
      ADMIN: new Set(PERMISSIONS),
    };
    const { service } = build(denied);
    await expect(service.getAssetPrice(actor, "a1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.getBatchPrices(actor, ["a1"])).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.getAssetHistory(actor, "a1", new Date(0), new Date(1)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
