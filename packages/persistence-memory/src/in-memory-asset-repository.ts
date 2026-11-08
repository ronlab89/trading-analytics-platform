import { AssetStatus } from "@trading/domain";
import type {
  Asset,
  AssetListFilter,
  AssetRepository,
  CreateAssetInput,
  Page,
  PageRequest,
} from "@trading/domain";

/**
 * In-memory implementation of `AssetRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `status` defaults to ACTIVE and `metadata` to
 * `{}`, `symbol` is unique, `search` is a case-insensitive "contains" over
 * symbol and name, the list is ordered by symbol ascending, and `update`
 * throws when the row does not exist. There is no `delete`, as in the
 * contract.
 */
export class InMemoryAssetRepository implements AssetRepository {
  private readonly rows = new Map<string, Asset>();
  private sequence = 0;

  list(filter: AssetListFilter, { page, pageSize }: PageRequest): Promise<Page<Asset>> {
    const search = filter.search?.toLowerCase();

    const matching = [...this.rows.values()]
      .filter(
        (asset) =>
          (filter.assetType === undefined || asset.assetType === filter.assetType) &&
          (filter.exchange === undefined || asset.exchange === filter.exchange) &&
          (filter.currency === undefined || asset.currency === filter.currency) &&
          (filter.status === undefined || asset.status === filter.status) &&
          (search === undefined ||
            asset.symbol.toLowerCase().includes(search) ||
            asset.name.toLowerCase().includes(search)),
      )
      .sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));

    return Promise.resolve({
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      total: matching.length,
    });
  }

  getById(id: string): Promise<Asset | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  getByIds(ids: readonly string[]): Promise<Asset[]> {
    const wanted = new Set(ids);

    return Promise.resolve([...this.rows.values()].filter((asset) => wanted.has(asset.id)));
  }

  getBySymbol(symbol: string): Promise<Asset | null> {
    const found = [...this.rows.values()].find((asset) => asset.symbol === symbol);

    return Promise.resolve(found ?? null);
  }

  create(input: CreateAssetInput): Promise<Asset> {
    const duplicate = [...this.rows.values()].some((asset) => asset.symbol === input.symbol);

    if (duplicate) {
      return Promise.reject(new Error(`An asset with symbol ${input.symbol} already exists.`));
    }

    const asset: Asset = {
      id: `asset_${String(++this.sequence)}`,
      symbol: input.symbol,
      name: input.name,
      assetType: input.assetType,
      currency: input.currency,
      exchange: input.exchange,
      status: input.status ?? AssetStatus.ACTIVE,
      metadata: input.metadata ?? {},
    };
    this.rows.set(asset.id, asset);

    return Promise.resolve(asset);
  }

  update(
    id: string,
    input: Partial<Pick<Asset, "name" | "exchange" | "status" | "metadata">>,
  ): Promise<Asset> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Asset ${id} does not exist.`));
    }

    const updated: Asset = { ...existing, ...input };
    this.rows.set(id, updated);

    return Promise.resolve(updated);
  }
}
