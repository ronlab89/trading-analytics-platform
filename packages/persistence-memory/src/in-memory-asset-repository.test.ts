import { describe, expect, it } from "vitest";
import { AssetStatus, AssetType } from "@trading/domain";
import { InMemoryAssetRepository } from "./in-memory-asset-repository.js";

const apple = {
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: AssetType.STOCK,
  currency: "USD",
  exchange: "NASDAQ",
};
const bitcoin = {
  symbol: "BTC",
  name: "Bitcoin",
  assetType: AssetType.CRYPTO,
  currency: "USD",
  exchange: "COINBASE",
};
const page = { page: 1, pageSize: 10 };

async function seeded() {
  const repository = new InMemoryAssetRepository();
  // Created out of symbol order on purpose: listing must sort by symbol.
  const btc = await repository.create(bitcoin);
  const aapl = await repository.create(apple);
  const msft = await repository.create({
    symbol: "MSFT",
    name: "Microsoft",
    assetType: AssetType.STOCK,
    currency: "USD",
    exchange: "NASDAQ",
    status: AssetStatus.INACTIVE,
  });
  return { repository, btc, aapl, msft };
}

describe("InMemoryAssetRepository", () => {
  it("creates an asset with an id, ACTIVE status and empty metadata by default", async () => {
    const created = await new InMemoryAssetRepository().create(apple);
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({ ...apple, status: AssetStatus.ACTIVE, metadata: {} });
  });

  it("keeps explicit status and metadata", async () => {
    const created = await new InMemoryAssetRepository().create({
      ...apple,
      status: AssetStatus.INACTIVE,
      metadata: { sector: "Tech" },
    });
    expect(created.status).toBe(AssetStatus.INACTIVE);
    expect(created.metadata).toEqual({ sector: "Tech" });
  });

  it("rejects a duplicate symbol", async () => {
    const repository = new InMemoryAssetRepository();
    await repository.create(apple);
    await expect(repository.create({ ...apple, name: "Other" })).rejects.toThrow();
  });

  it("finds by id, by symbol and by several ids, and returns null or nothing for unknown ones", async () => {
    const { repository, btc, aapl } = await seeded();
    expect(await repository.getById(aapl.id)).toEqual(aapl);
    expect(await repository.getById("ghost")).toBeNull();
    expect(await repository.getBySymbol("BTC")).toEqual(btc);
    expect(await repository.getBySymbol("ghost")).toBeNull();
    const found = await repository.getByIds([btc.id, "ghost", aapl.id]);
    expect(found.map((a) => a.symbol).sort()).toEqual(["AAPL", "BTC"]);
    expect(await repository.getByIds([])).toEqual([]);
  });

  it("lists every asset ordered by symbol with the total", async () => {
    const { repository } = await seeded();
    const result = await repository.list({}, page);
    expect(result.items.map((a) => a.symbol)).toEqual(["AAPL", "BTC", "MSFT"]);
    expect(result.total).toBe(3);
  });

  it("filters by type, exchange, currency and status", async () => {
    const { repository } = await seeded();
    const symbols = async (filter: Parameters<typeof repository.list>[0]) =>
      (await repository.list(filter, page)).items.map((a) => a.symbol);
    expect(await symbols({ assetType: AssetType.CRYPTO })).toEqual(["BTC"]);
    expect(await symbols({ exchange: "NASDAQ" })).toEqual(["AAPL", "MSFT"]);
    expect(await symbols({ currency: "EUR" })).toEqual([]);
    expect(await symbols({ status: AssetStatus.INACTIVE })).toEqual(["MSFT"]);
  });

  it("searches symbol and name, ignoring case", async () => {
    const { repository } = await seeded();
    const symbols = async (search: string) =>
      (await repository.list({ search }, page)).items.map((a) => a.symbol);
    expect(await symbols("aap")).toEqual(["AAPL"]);
    expect(await symbols("MICRO")).toEqual(["MSFT"]);
    expect(await symbols("zzz")).toEqual([]);
  });

  it("paginates and reports the unpaged total", async () => {
    const { repository } = await seeded();
    const second = await repository.list({}, { page: 2, pageSize: 2 });
    expect(second.items.map((a) => a.symbol)).toEqual(["MSFT"]);
    expect(second.total).toBe(3);
  });

  it("updates only the given fields", async () => {
    const { repository, aapl } = await seeded();
    const updated = await repository.update(aapl.id, { status: AssetStatus.INACTIVE });
    expect(updated).toEqual({ ...aapl, status: AssetStatus.INACTIVE });
    expect(await repository.getById(aapl.id)).toEqual(updated);
  });

  it("throws when updating an asset that does not exist", async () => {
    await expect(new InMemoryAssetRepository().update("ghost", { name: "x" })).rejects.toThrow();
  });
});
