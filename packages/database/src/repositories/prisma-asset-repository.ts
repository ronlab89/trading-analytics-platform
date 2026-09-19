import type {
  Asset,
  AssetListFilter,
  AssetRepository,
  CreateAssetInput,
  Page,
  PageRequest,
} from "@trading/domain";
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
  async list(filter: AssetListFilter, { page, pageSize }: PageRequest): Promise<Page<Asset>> {
    const where: Prisma.AssetWhereInput = {
      ...(filter.assetType !== undefined ? { assetType: filter.assetType } : {}),
      ...(filter.exchange !== undefined ? { exchange: filter.exchange } : {}),
      ...(filter.currency !== undefined ? { currency: filter.currency } : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.search !== undefined
        ? {
            OR: [
              { symbol: { contains: filter.search, mode: "insensitive" } },
              { name: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // Single batch so the page and the total come from the same snapshot.
    const [rows, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        orderBy: { symbol: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    return { items: rows.map(toDomainAsset), total };
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
