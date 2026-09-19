import type { Asset, CreateAssetInput } from "../entities/asset";
import type { AssetType } from "../entities/enums";

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
   * Returns assets, optionally filtered.
   * Source: FR-019 (List Assets), FR-020 (Asset Search).
   *
   * Search/filter parameters are plain optional fields rather than a
   * generic query-builder object, keeping the contract explicit about
   * what filtering the domain actually needs today (03-non-functional
   * -requirements.md NFR-070, avoid artificial complexity).
   */
  list(filter?: { search?: string; assetType?: AssetType }): Promise<Asset[]>;

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
