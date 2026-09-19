import type { Asset, CreateAssetInput } from "../entities/asset";
import type { AssetStatus, AssetType } from "../entities/enums";
import type { Page, PageRequest } from "./pagination";

/**
 * Filters supported when listing assets.
 * Source: 07-api-spec.md §17 (List Assets filters), FR-019/FR-020.
 *
 * Plain optional fields rather than a generic query-builder object,
 * keeping the contract explicit about what filtering the domain
 * actually needs today (NFR-070). `search` matches symbol or name,
 * case-insensitively; every other field is an exact match.
 */
export interface AssetListFilter {
  search?: string;
  assetType?: AssetType;
  exchange?: string;
  currency?: string;
  status?: AssetStatus;
}

/**
 * Asset repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface AssetRepository {
  /**
   * Returns one page of assets matching the filter.
   * Source: FR-019 (List Assets), FR-020 (Asset Search),
   * 07-api-spec.md §17 and §40.
   *
   * Results are ordered by symbol ascending so pagination is stable
   * (symbols are unique): the same page request always returns the
   * same slice unless the underlying data changed.
   */
  list(filter: AssetListFilter, page: PageRequest): Promise<Page<Asset>>;

  /**
   * Returns a single asset by id, or null if it does not exist.
   */
  getById(id: string): Promise<Asset | null>;

  /**
   * Returns a single asset by symbol, or null if it does not exist.
   * Symbols are unique (see schema.prisma `@unique` constraint), so this
   * is a legitimate direct lookup, not just a filtered list() call.
   */
  getBySymbol(symbol: string): Promise<Asset | null>;

  /**
   * Creates a new asset.
   * Callers are expected to have already run `validateNewAsset` (see
   * entities/asset.ts) before calling this.
   */
  create(input: CreateAssetInput): Promise<Asset>;

  /**
   * Updates supported, mutable fields of an existing asset.
   * `status` transitions (e.g. marking an asset INACTIVE rather than
   * deleting it — see 09-security-spec.md style historical-integrity
   * reasoning applied to Transaction/Asset in schema.prisma's
   * onDelete: Restrict comment) go through this same method.
   */
  update(
    id: string,
    input: Partial<Pick<Asset, "name" | "exchange" | "status" | "metadata">>,
  ): Promise<Asset>;
}
