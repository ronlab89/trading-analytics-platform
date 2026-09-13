import { afterAll, describe, expect, it } from "vitest";
import { PrismaAssetRepository } from "../prisma-asset-repository";
import { prisma } from "../../client";

/**
 * Integration test for `PrismaAssetRepository`.
 * See prisma-portfolio-repository.test.ts for the shared preconditions
 * (Docker Postgres up and migrated).
 */
describe("PrismaAssetRepository", () => {
  const repository = new PrismaAssetRepository();
  const createdAssetIds: string[] = [];

  afterAll(async () => {
    await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
    await prisma.$disconnect();
  });

  function uniqueSymbol(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  it("creates an asset with default status and empty metadata", async () => {
    const asset = await repository.create({
      symbol: uniqueSymbol("BTC"),
      name: "Bitcoin",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    });
    createdAssetIds.push(asset.id);

    expect(asset.status).toBe("ACTIVE");
    expect(asset.metadata).toEqual({});
  });

  it("creates an asset with explicit metadata", async () => {
    const asset = await repository.create({
      symbol: uniqueSymbol("ETH"),
      name: "Ethereum",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
      metadata: { network: "mainnet", decimals: 18 },
    });
    createdAssetIds.push(asset.id);

    expect(asset.metadata).toEqual({ network: "mainnet", decimals: 18 });
  });

  it("retrieves an asset by id and by symbol", async () => {
    const symbol = uniqueSymbol("AAPL");
    const created = await repository.create({
      symbol,
      name: "Apple Inc.",
      assetType: "STOCK",
      currency: "USD",
      exchange: "NASDAQ",
    });
    createdAssetIds.push(created.id);

    expect((await repository.getById(created.id))?.id).toBe(created.id);
    expect((await repository.getBySymbol(symbol))?.id).toBe(created.id);
  });

  it("returns null when an asset does not exist", async () => {
    expect(await repository.getById("nonexistent-id")).toBeNull();
    expect(await repository.getBySymbol("NONEXISTENT")).toBeNull();
  });

  it("filters by assetType and by search term", async () => {
    const symbol = uniqueSymbol("VOO");
    const created = await repository.create({
      symbol,
      name: "Vanguard S&P 500 ETF",
      assetType: "ETF",
      currency: "USD",
      exchange: "NYSE",
    });
    createdAssetIds.push(created.id);

    const byType = await repository.list({ assetType: "ETF" });
    expect(byType.some((a) => a.id === created.id)).toBe(true);
    expect(byType.every((a) => a.assetType === "ETF")).toBe(true);

    const bySearch = await repository.list({ search: symbol });
    expect(bySearch).toHaveLength(1);
    expect(bySearch[0]?.id).toBe(created.id);
  });

  it("updates mutable fields, including metadata and status", async () => {
    const created = await repository.create({
      symbol: uniqueSymbol("SOL"),
      name: "Solana",
      assetType: "CRYPTO",
      currency: "USD",
      exchange: "MOCK",
    });
    createdAssetIds.push(created.id);

    const updated = await repository.update(created.id, {
      status: "INACTIVE",
      metadata: { retiredReason: "delisted" },
    });

    expect(updated.status).toBe("INACTIVE");
    expect(updated.metadata).toEqual({ retiredReason: "delisted" });
  });
});
