import { PortfolioStatus } from "@trading/domain";
import type { CreatePortfolioInput, Portfolio, PortfolioRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `PortfolioRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: no business rules, `description` defaults to
 * null and `status` to ACTIVE, and `update` and `delete` throw when the row
 * does not exist (Prisma's P2025), as the contract documents.
 */
export class InMemoryPortfolioRepository implements PortfolioRepository {
  private readonly rows = new Map<string, Portfolio>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  listByUserId(userId: string): Promise<Portfolio[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.userId === userId));
  }

  getById(id: string): Promise<Portfolio | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  create(input: CreatePortfolioInput): Promise<Portfolio> {
    const timestamp = this.now();
    const portfolio: Portfolio = {
      id: `portfolio_${String(++this.sequence)}`,
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      baseCurrency: input.baseCurrency,
      status: input.status ?? PortfolioStatus.ACTIVE,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(portfolio.id, portfolio);

    return Promise.resolve(portfolio);
  }

  update(
    id: string,
    input: Partial<Pick<Portfolio, "name" | "description" | "baseCurrency" | "status">>,
  ): Promise<Portfolio> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Portfolio ${id} does not exist.`));
    }

    const updated: Portfolio = { ...existing, ...input, updatedAt: this.now() };
    this.rows.set(id, updated);

    return Promise.resolve(updated);
  }

  delete(id: string): Promise<void> {
    if (!this.rows.delete(id)) {
      return Promise.reject(new Error(`Portfolio ${id} does not exist.`));
    }

    return Promise.resolve();
  }
}
