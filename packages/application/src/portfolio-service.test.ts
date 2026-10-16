import { describe, expect, it, vi } from "vitest";
import { InvalidPortfolioError } from "@trading/domain";
import type { CreatePortfolioInput, Portfolio, PortfolioRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createPortfolioService } from "./portfolio-service.js";

const owner: Actor = { userId: "u1", role: "USER" };
const stranger: Actor = { userId: "u2", role: "USER" };

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "p1",
    userId: "u1",
    name: "Main",
    description: null,
    baseCurrency: "USD",
    status: "ACTIVE",
    createdAt: new Date("2026-10-01T12:00:00.000Z"),
    updatedAt: new Date("2026-10-01T12:00:00.000Z"),
    ...overrides,
  };
}

/** Minimal fake of the repository contract: a Map, no persistence. */
function fakeRepository(initial: Portfolio[] = []) {
  const rows = new Map(initial.map((p) => [p.id, p]));
  const update = vi.fn((id: string, input: Partial<Portfolio>) => {
    const current = rows.get(id);
    if (!current) return Promise.reject(new Error("missing"));
    const next = { ...current, ...input };
    rows.set(id, next);
    return Promise.resolve(next);
  });
  const create = vi.fn((input: CreatePortfolioInput) => {
    const created = portfolio({
      id: `p${String(rows.size + 1)}`,
      userId: input.userId,
      name: input.name,
      baseCurrency: input.baseCurrency,
      description: input.description ?? null,
    });
    rows.set(created.id, created);
    return Promise.resolve(created);
  });
  const repository: PortfolioRepository = {
    listByUserId: (userId) =>
      Promise.resolve([...rows.values()].filter((p) => p.userId === userId)),
    getById: (id) => Promise.resolve(rows.get(id) ?? null),
    create,
    update,
    delete: (id) => {
      rows.delete(id);
      return Promise.resolve();
    },
  };
  return { repository, update, create };
}

describe("portfolio service", () => {
  describe("listPortfolios", () => {
    it("returns only the actor's portfolios", async () => {
      const { repository } = fakeRepository([
        portfolio({ id: "a", userId: "u1" }),
        portfolio({ id: "b", userId: "u2" }),
      ]);
      const service = createPortfolioService({ portfolioRepository: repository });
      expect((await service.listPortfolios(owner)).map((p) => p.id)).toEqual(["a"]);
    });
  });

  describe("getPortfolioById", () => {
    it("returns an owned portfolio", async () => {
      const { repository } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      expect((await service.getPortfolioById(owner, "p1")).id).toBe("p1");
    });

    it("throws the same NotFoundError for a foreign and a missing portfolio (anti-enumeration)", async () => {
      const { repository } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      const foreign = await service.getPortfolioById(stranger, "p1").catch((e: unknown) => e);
      const missing = await service.getPortfolioById(owner, "nope").catch((e: unknown) => e);
      expect(foreign).toBeInstanceOf(NotFoundError);
      expect(missing).toBeInstanceOf(NotFoundError);
      expect((foreign as Error).message).toBe((missing as Error).message);
      expect((foreign as Error).message).toBe("The requested resource could not be found.");
    });
  });

  describe("createPortfolio", () => {
    it("creates the portfolio for the actor, never for a client-supplied owner", async () => {
      const { repository, create } = fakeRepository();
      const service = createPortfolioService({ portfolioRepository: repository });
      const created = await service.createPortfolio(owner, { name: "New", baseCurrency: "USD" });
      expect(created.userId).toBe("u1");
      expect(create).toHaveBeenCalledWith({ userId: "u1", name: "New", baseCurrency: "USD" });
    });

    it("runs the domain validation before touching the repository", async () => {
      const { repository, create } = fakeRepository();
      const service = createPortfolioService({ portfolioRepository: repository });
      await expect(
        service.createPortfolio(owner, { name: "  ", baseCurrency: "USD" }),
      ).rejects.toBeInstanceOf(InvalidPortfolioError);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("updatePortfolio", () => {
    it("updates name and description only", async () => {
      const { repository, update } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      await service.updatePortfolio(owner, "p1", { name: "Renamed" });
      expect(update).toHaveBeenCalledWith("p1", { name: "Renamed" });
    });

    it("does not write when the portfolio is not the actor's", async () => {
      const { repository, update } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      await expect(service.updatePortfolio(stranger, "p1", { name: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("rejects updating an archived portfolio with a conflict and writes nothing", async () => {
      const { repository, update } = fakeRepository([portfolio({ status: "ARCHIVED" })]);
      const service = createPortfolioService({ portfolioRepository: repository });
      const error = await service
        .updatePortfolio(owner, "p1", { name: "x" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe("An archived portfolio cannot be modified.");
      expect(update).not.toHaveBeenCalled();
    });

    it("keeps answering 404 for another user's archived portfolio", async () => {
      const { repository } = fakeRepository([portfolio({ status: "ARCHIVED" })]);
      const service = createPortfolioService({ portfolioRepository: repository });
      await expect(service.updatePortfolio(stranger, "p1", { name: "x" })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("archivePortfolio", () => {
    it("archives an active portfolio", async () => {
      const { repository, update } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      const result = await service.archivePortfolio(owner, "p1");
      expect(result.alreadyArchived).toBe(false);
      expect(result.portfolio.status).toBe("ARCHIVED");
      expect(update).toHaveBeenCalledWith("p1", { status: "ARCHIVED" });
    });

    it("is idempotent: an archived portfolio is returned with alreadyArchived and no write", async () => {
      const { repository, update } = fakeRepository([portfolio({ status: "ARCHIVED" })]);
      const service = createPortfolioService({ portfolioRepository: repository });
      const result = await service.archivePortfolio(owner, "p1");
      expect(result.alreadyArchived).toBe(true);
      expect(update).not.toHaveBeenCalled();
    });

    it("does not write when the portfolio is not the actor's", async () => {
      const { repository, update } = fakeRepository([portfolio()]);
      const service = createPortfolioService({ portfolioRepository: repository });
      await expect(service.archivePortfolio(stranger, "p1")).rejects.toBeInstanceOf(NotFoundError);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("permissions", () => {
    const readOnly: RolePermissions = {
      USER: new Set(["portfolio:read"]),
      ADMIN: new Set(PERMISSIONS),
    };

    it("reads need portfolio:read and writes need portfolio:write", async () => {
      const { repository, create, update } = fakeRepository([portfolio()]);
      const service = createPortfolioService({
        portfolioRepository: repository,
        permissions: readOnly,
      });

      await expect(service.listPortfolios(owner)).resolves.toHaveLength(1);
      await expect(service.getPortfolioById(owner, "p1")).resolves.toBeDefined();
      await expect(
        service.createPortfolio(owner, { name: "New", baseCurrency: "USD" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(service.updatePortfolio(owner, "p1", { name: "x" })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(service.archivePortfolio(owner, "p1")).rejects.toBeInstanceOf(ForbiddenError);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });
});
