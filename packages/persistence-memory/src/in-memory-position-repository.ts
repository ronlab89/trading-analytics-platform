import type { CreatePositionInput, Money, Position, PositionRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryPositionSnapshot {
  readonly rows: ReadonlyMap<string, Position>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `PositionRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: one position per (portfolio, asset); `upsert`
 * keeps the id and `openedAt` of an existing position and only moves
 * `updatedAt`; `updateCurrentPrice` and `deleteByPortfolioAndAsset` throw when
 * the row does not exist.
 */
export class InMemoryPositionRepository implements PositionRepository {
  private readonly rows = new Map<string, Position>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryPositionSnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryPositionSnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  listByPortfolioId(portfolioId: string): Promise<Position[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((row) => row.portfolioId === portfolioId),
    );
  }

  getById(id: string): Promise<Position | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  getByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<Position | null> {
    return Promise.resolve(this.find(portfolioId, assetId) ?? null);
  }

  upsert(input: CreatePositionInput): Promise<Position> {
    const timestamp = this.now();
    const existing = this.find(input.portfolioId, input.assetId);

    const position: Position = {
      id: existing?.id ?? `position_${String(++this.sequence)}`,
      portfolioId: input.portfolioId,
      assetId: input.assetId,
      quantity: input.quantity,
      averageEntryPrice: input.averageEntryPrice,
      currentPrice: input.currentPrice,
      openedAt: input.openedAt ?? existing?.openedAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(position.id, position);

    return Promise.resolve(position);
  }

  updateCurrentPrice(id: string, currentPrice: Money): Promise<Position> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Position ${id} does not exist.`));
    }

    const updated: Position = { ...existing, currentPrice, updatedAt: this.now() };
    this.rows.set(id, updated);

    return Promise.resolve(updated);
  }

  deleteByPortfolioAndAsset(portfolioId: string, assetId: string): Promise<void> {
    const existing = this.find(portfolioId, assetId);

    if (!existing) {
      return Promise.reject(
        new Error(`No position for portfolio ${portfolioId} and asset ${assetId}.`),
      );
    }

    this.rows.delete(existing.id);

    return Promise.resolve();
  }

  private find(portfolioId: string, assetId: string): Position | undefined {
    return [...this.rows.values()].find(
      (row) => row.portfolioId === portfolioId && row.assetId === assetId,
    );
  }
}
