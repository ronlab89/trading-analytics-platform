import type {
  CreateWatchlistItemInput,
  WatchlistItem,
  WatchlistItemRepository,
} from "@trading/domain";
import { InvalidWatchlistItemError } from "@trading/domain";
import { Prisma } from "../../generated/client/index.js";
import { prisma } from "../client.js";
import { toDomainWatchlistItem } from "../mappers/watchlist-item-mapper.js";

/**
 * Prisma-backed implementation of `WatchlistItemRepository`.
 *
 * `create()` relies on the `@@unique([userId, assetId])` constraint
 * (schema.prisma) as the authoritative duplicate guard, per the
 * contract's own module comment. Prisma surfaces a violation as a
 * `PrismaClientKnownRequestError` with code `P2002` — this is
 * translated into `InvalidWatchlistItemError` (the domain's existing
 * error type for this entity) rather than leaking a raw Prisma error
 * across the repository boundary.
 */
export class PrismaWatchlistItemRepository implements WatchlistItemRepository {
  async listByUserId(userId: string): Promise<WatchlistItem[]> {
    const rows = await prisma.watchlistItem.findMany({ where: { userId } });
    return rows.map(toDomainWatchlistItem);
  }

  async create(input: CreateWatchlistItemInput): Promise<WatchlistItem> {
    try {
      const row = await prisma.watchlistItem.create({ data: input });
      return toDomainWatchlistItem(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new InvalidWatchlistItemError(
          `Asset ${input.assetId} is already on this user's watchlist.`,
        );
      }
      throw error;
    }
  }

  async deleteByUserAndAsset(userId: string, assetId: string): Promise<void> {
    await prisma.watchlistItem.delete({ where: { userId_assetId: { userId, assetId } } });
  }
}
