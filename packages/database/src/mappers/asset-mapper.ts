import type { Asset as PrismaAsset, Prisma } from "../../generated/client/index.js";
import type { Asset, AssetStatus, AssetType, CreateAssetInput } from "@trading/domain";

/** Same enum-bridging rationale as portfolio-mapper.ts / user-mapper.ts. */
function toDomainAssetType(assetType: PrismaAsset["assetType"]): AssetType {
  return assetType;
}

function toDomainAssetStatus(status: PrismaAsset["status"]): AssetStatus {
  return status;
}

/**
 * Prisma types a `Json` column as `Prisma.JsonValue` on read — a union
 * that also allows primitives and arrays, not just objects. The domain
 * entity narrows this to `Readonly<Record<string, unknown>>` (see
 * entities/asset.ts), matching how `metadata` is actually used and
 * validated at the application boundary. Values written through this
 * repository always originate from `CreateAssetInput.metadata`, which is
 * already typed as a record at the domain layer — so this cast documents
 * an assumption already enforced upstream, rather than introducing a new
 * one.
 */
function toDomainMetadata(metadata: PrismaAsset["metadata"]): Readonly<Record<string, unknown>> {
  return metadata as Readonly<Record<string, unknown>>;
}

export function toDomainAsset(row: PrismaAsset): Asset {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    assetType: toDomainAssetType(row.assetType),
    currency: row.currency,
    exchange: row.exchange,
    status: toDomainAssetStatus(row.status),
    metadata: toDomainMetadata(row.metadata),
  };
}

export function toPrismaCreateInput(input: CreateAssetInput) {
  return {
    symbol: input.symbol,
    name: input.name,
    assetType: input.assetType,
    currency: input.currency,
    exchange: input.exchange,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
  };
}
