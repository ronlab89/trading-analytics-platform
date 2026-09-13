import type { Asset, AssetRepository, AssetType, CreateAssetInput } from "@trading/domain";
import type { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainAsset, toPrismaCreateInput } from "../mappers/asset-mapper.js";

/**
 * Prisma-backed implementation of `AssetRepository`.
 * See prisma-portfolio-repository.ts for the shared rationale.
 *
 * Note: this repository intentionally has no `delete()` method — the
 * contract does not define one, matching `onDelete: Restrict` from
 * Asset to Transaction/Position in schema.prisma (historical integrity;
 * `AssetStatus.INACTIVE` is the correct path for retiring an asset).
 */
export class PrismaAssetRepository implements AssetRepository {
  async list(filter?: { search?: string; assetType?: AssetType }): Promise<Asset[]> {
    const where: Prisma.AssetWhereInput = {
      ...(filter?.assetType !== undefined ? { assetType: filter.assetType } : {}),
      ...(filter?.search !== undefined
        ? {
            OR: [
              { symbol: { contains: filter.search, mode: "insensitive" } },
              { name: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await prisma.asset.findMany({ where });
    return rows.map(toDomainAsset);
  }

  async getById(id: string): Promise<Asset | null> {
    const row = await prisma.asset.findUnique({ where: { id } });
    return row ? toDomainAsset(row) : null;
  }

  async getBySymbol(symbol: string): Promise<Asset | null> {
    const row = await prisma.asset.findUnique({ where: { symbol } });
    return row ? toDomainAsset(row) : null;
  }

  async create(input: CreateAssetInput): Promise<Asset> {
    const row = await prisma.asset.create({ data: toPrismaCreateInput(input) });
    return toDomainAsset(row);
  }

  async update(
    id: string,
    input: Partial<Pick<Asset, "name" | "exchange" | "status" | "metadata">>,
  ): Promise<Asset> {
    const { metadata, ...rest } = input;
    const row = await prisma.asset.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
    return toDomainAsset(row);
  }
}
