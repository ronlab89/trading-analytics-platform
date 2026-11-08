import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssetStatus, AssetType } from "@trading/domain";
import type { AssetListFilter, AssetRepository, CreateAssetInput } from "@trading/domain";

export interface AssetContractContext {
  readonly repository: AssetRepository;
  /** Removes whatever the factory created. */
  readonly cleanup: () => Promise<void>;
}

/** Every symbol the suite creates starts with this, so an adapter can clean up by it. */
export const ASSET_CONTRACT_SYMBOL_PREFIX = "CT-";

/**
 * Behavior every `AssetRepository` must have, whatever the storage.
 * Source: docs/10-testing-strategy.md §17.
 *
 * Each test tags its symbols, names and exchange with a unique value and scopes
 * every listing to it, so the suite also runs against a shared database.
 */
export function assetRepositoryContract(
  name: string,
  factory: () => Promise<AssetContractContext>,
): void {
  describe(`${name} (AssetRepository contract)`, () => {
    let context: AssetContractContext;
    let tag: string;

    beforeEach(async () => {
      context = await factory();
      tag = `${ASSET_CONTRACT_SYMBOL_PREFIX}${crypto.randomUUID().slice(0, 8)}`;
    });

    afterEach(async () => {
      await context.cleanup();
    });

    const input = (suffix: string, overrides: Partial<CreateAssetInput> = {}) => ({
      symbol: `${tag}-${suffix}`,
      name: `Asset ${suffix} ${tag}`,
      assetType: AssetType.STOCK,
      currency: "USD",
      exchange: `EX-${tag}`,
      ...overrides,
    });

    const symbolsOf = async (filter: AssetListFilter) => {
      const result = await context.repository.list(
        { search: tag, ...filter },
        { page: 1, pageSize: 10 },
      );
      return result.items.map((asset) => asset.symbol);
    };

    it("creates an asset with an id, ACTIVE status and empty metadata by default", async () => {
      const created = await context.repository.create(input("A"));
      expect(created.id).not.toBe("");
      expect(created).toMatchObject({ ...input("A"), status: AssetStatus.ACTIVE, metadata: {} });
    });

    it("keeps an explicit status and metadata", async () => {
      const metadata = { network: "mainnet", decimals: 18 };
      const created = await context.repository.create(
        input("A", { status: AssetStatus.INACTIVE, metadata }),
      );
      expect(created.status).toBe(AssetStatus.INACTIVE);
      expect(created.metadata).toEqual(metadata);
    });

    it("rejects a duplicate symbol", async () => {
      await context.repository.create(input("A"));
      await expect(context.repository.create(input("A", { name: "Other" }))).rejects.toThrow();
    });

    it("finds by id, by symbol and by several ids, and ignores unknown ones", async () => {
      const a = await context.repository.create(input("A"));
      const b = await context.repository.create(input("B"));
      expect(await context.repository.getById(a.id)).toEqual(a);
      expect(await context.repository.getById("nonexistent-id")).toBeNull();
      expect(await context.repository.getBySymbol(a.symbol)).toEqual(a);
      expect(await context.repository.getBySymbol(`${tag}-NONE`)).toBeNull();
      const found = await context.repository.getByIds([a.id, "nonexistent-id", b.id]);
      expect(found.map((asset) => asset.id).sort()).toEqual([a.id, b.id].sort());
      expect(await context.repository.getByIds([])).toEqual([]);
    });

    it("filters by type, exchange, currency and status", async () => {
      await context.repository.create(input("BTC", { assetType: AssetType.CRYPTO }));
      await context.repository.create(input("AAPL"));
      await context.repository.create(input("MSFT", { status: AssetStatus.INACTIVE }));
      expect(await symbolsOf({ assetType: AssetType.CRYPTO })).toEqual([`${tag}-BTC`]);
      expect(await symbolsOf({ exchange: `EX-${tag}` })).toHaveLength(3);
      expect(await symbolsOf({ currency: "EUR" })).toEqual([]);
      expect(await symbolsOf({ status: AssetStatus.INACTIVE })).toEqual([`${tag}-MSFT`]);
    });

    it("searches symbol and name, ignoring case", async () => {
      await context.repository.create(input("A", { name: `Zeta Corp ${tag}` }));
      expect(await symbolsOf({ search: tag.toLowerCase() })).toEqual([`${tag}-A`]);
      expect(await symbolsOf({ search: `zeta corp ${tag}` })).toEqual([`${tag}-A`]);
      expect(await symbolsOf({ search: `${tag}-none` })).toEqual([]);
    });

    // `%`, `_` and `\` are LIKE wildcards or escapes in PostgreSQL; the term is plain text.
    it.each([
      { character: "%", literal: "100% growth", lookalike: "100x growth" },
      { character: "_", literal: "a_b", lookalike: "axb" },
      { character: "\\", literal: "c\\d", lookalike: "cd" },
    ])("matches '$character' in the search literally", async ({ literal, lookalike }) => {
      await context.repository.create(input("LIT", { name: `Fund ${tag} ${literal}` }));
      await context.repository.create(input("LOOK", { name: `Fund ${tag} ${lookalike}` }));

      expect(await symbolsOf({ search: `${tag} ${literal}` })).toEqual([`${tag}-LIT`]);
      expect(await symbolsOf({ search: `${tag} ${lookalike}` })).toEqual([`${tag}-LOOK`]);
    });

    it("lists ordered by symbol, paginates and reports the unpaged total", async () => {
      for (const suffix of ["C", "A", "B"]) {
        await context.repository.create(input(suffix));
      }
      expect(await symbolsOf({})).toEqual([`${tag}-A`, `${tag}-B`, `${tag}-C`]);
      const second = await context.repository.list({ search: tag }, { page: 2, pageSize: 2 });
      expect(second.items.map((asset) => asset.symbol)).toEqual([`${tag}-C`]);
      expect(second.total).toBe(3);
    });

    it("updates only the given fields", async () => {
      const created = await context.repository.create(input("A"));
      const metadata = { retiredReason: "delisted" };
      const updated = await context.repository.update(created.id, {
        status: AssetStatus.INACTIVE,
        metadata,
      });
      expect(updated).toEqual({ ...created, status: AssetStatus.INACTIVE, metadata });
      expect(await context.repository.getById(created.id)).toEqual(updated);
    });

    it("throws when updating an asset that does not exist", async () => {
      await expect(context.repository.update("nonexistent-id", { name: "x" })).rejects.toThrow();
    });
  });
}
