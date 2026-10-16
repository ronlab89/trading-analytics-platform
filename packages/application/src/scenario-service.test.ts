import { describe, expect, it, vi } from "vitest";
import { InvalidScenarioError, Money, PortfolioStatus, ScenarioStatus } from "@trading/domain";
import type { Asset, Portfolio, Position, Scenario } from "@trading/domain";
import type { Actor } from "./actor.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationFailedError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createScenarioService } from "./scenario-service.js";

const actor: Actor = { userId: "u1", role: "USER" };

const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

const held: Position = {
  id: "x1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 2,
  averageEntryPrice: Money.of("100", "USD"),
  currentPrice: Money.of("150", "USD"),
  openedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

function scenario(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return {
    id,
    portfolioId: "p1",
    name: `Scenario ${id}`,
    description: null,
    baseSnapshotId: null,
    status: ScenarioStatus.DRAFT,
    changes: [{ assetId: "a1", percentChange: 10 }],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const knownAssets: Asset[] = [
  { id: "a1", symbol: "AAA", name: "Asset A" } as Asset,
  { id: "a2", symbol: "BBB", name: "Asset B" } as Asset,
];

interface Options {
  scenarios?: Scenario[];
  ownedPortfolios?: string[];
  archivedPortfolios?: string[];
  permissions?: RolePermissions;
}

function build(options: Options = {}) {
  const {
    scenarios = [scenario("s1")],
    ownedPortfolios = ["p1"],
    archivedPortfolios = [],
  } = options;

  const create = vi.fn((input: { portfolioId: string; name: string }) =>
    Promise.resolve(scenario("new", { name: input.name })),
  );
  const update = vi.fn((id: string, input: Partial<Scenario>) =>
    Promise.resolve(scenario(id, input)),
  );
  const remove = vi.fn((_id: string) => Promise.resolve());
  const getAssetsByIds = vi.fn((_actor: Actor, ids: readonly string[]) =>
    Promise.resolve(new Map(knownAssets.filter((a) => ids.includes(a.id)).map((a) => [a.id, a]))),
  );

  const service = createScenarioService({
    scenarioRepository: {
      listByPortfolioId: () => Promise.resolve(scenarios),
      getById: (id: string) => Promise.resolve(scenarios.find((s) => s.id === id) ?? null),
      create,
      update,
      delete: remove,
    },
    positionRepository: { listByPortfolioId: () => Promise.resolve([held]) },
    portfolioService: {
      getPortfolioById: (_actor: Actor, portfolioId: string) =>
        ownedPortfolios.includes(portfolioId)
          ? Promise.resolve(
              archivedPortfolios.includes(portfolioId)
                ? { ...portfolio, status: PortfolioStatus.ARCHIVED }
                : portfolio,
            )
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    assetService: { getAssetsByIds },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, create, update, remove, getAssetsByIds };
}

describe("scenario service reads", () => {
  it("lists a portfolio's scenarios and filters them by status in memory", async () => {
    const { service } = build({
      scenarios: [scenario("s1"), scenario("s2", { status: ScenarioStatus.SAVED })],
    });
    expect(await service.listScenarios(actor, "p1", {})).toHaveLength(2);
    const saved = await service.listScenarios(actor, "p1", { status: ScenarioStatus.SAVED });
    expect(saved.map((s) => s.id)).toEqual(["s2"]);
  });

  it("does not list scenarios of a portfolio the actor does not own", async () => {
    const { service } = build({ ownedPortfolios: [] });
    await expect(service.listScenarios(actor, "p1", {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("raises NotFoundError for a scenario that belongs to another portfolio", async () => {
    const { service } = build({
      scenarios: [scenario("s1", { portfolioId: "p2" })],
      ownedPortfolios: ["p1", "p2"],
    });
    const error = await service.getScenarioById(actor, "p1", "s1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("calculates the impact and reports changed assets the portfolio does not hold", async () => {
    const { service } = build({
      scenarios: [
        scenario("s1", {
          changes: [
            { assetId: "a1", percentChange: 10 },
            { assetId: "a2", percentChange: 5 },
          ],
        }),
      ],
    });
    const result = await service.calculateScenario(actor, "p1", "s1");
    expect(result.scenarioId).toBe("s1");
    expect(result.unmatchedAssetIds).toEqual(["a2"]);
    expect(result.baseline).toBeDefined();
    expect(result.result).toBeDefined();
  });

  it("compares scenarios in the requested order, labelling assets with symbol and name", async () => {
    const { service } = build({ scenarios: [scenario("s1"), scenario("s2")] });
    const comparison = await service.compareScenarios(actor, "p1", ["s2", "s1"]);
    expect(comparison.scenarios.map((s) => s.scenarioId)).toEqual(["s2", "s1"]);
    expect(comparison.scenarios[0]?.name).toBe("Scenario s2");
    expect(comparison.baseline.assets[0]).toMatchObject({ symbol: "AAA", name: "Asset A" });
  });

  it("fails the whole comparison when one requested scenario is not in the portfolio", async () => {
    const { service } = build({ scenarios: [scenario("s1")] });
    await expect(service.compareScenarios(actor, "p1", ["s1", "nope"])).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("scenario service writes", () => {
  it("creates a scenario after validating the domain and the changed assets", async () => {
    const { service, create } = build();
    const created = await service.createScenario(actor, "p1", {
      name: "Rally",
      changes: [{ assetId: "a1", percentChange: 10 }],
    });
    expect(created.name).toBe("Rally");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("validates the domain before looking up any asset", async () => {
    const { service, getAssetsByIds, create } = build();
    await expect(service.createScenario(actor, "p1", { name: "  " })).rejects.toBeInstanceOf(
      InvalidScenarioError,
    );
    expect(getAssetsByIds).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("reports every unknown asset at once in a ValidationFailedError", async () => {
    const { service, create } = build();
    const error = await service
      .createScenario(actor, "p1", {
        name: "Bad",
        changes: [
          { assetId: "ghost1", percentChange: 1 },
          { assetId: "a1", percentChange: 1 },
          { assetId: "ghost2", percentChange: 1 },
        ],
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    expect((error as ValidationFailedError).message).toBe(
      "The scenario references assets that do not exist.",
    );
    expect((error as ValidationFailedError).details).toEqual([
      { field: "changes", code: "UNKNOWN_ASSET", message: "Unknown asset: ghost1" },
      { field: "changes", code: "UNKNOWN_ASSET", message: "Unknown asset: ghost2" },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it("updates only the provided fields", async () => {
    const { service, update } = build();
    await service.updateScenario(actor, "p1", "s1", { name: "Renamed" });
    expect(update).toHaveBeenCalledWith("s1", { name: "Renamed" });
  });

  it("refuses to modify an archived scenario with ConflictError", async () => {
    const { service, update } = build({
      scenarios: [scenario("s1", { status: ScenarioStatus.ARCHIVED })],
    });
    const error = await service
      .updateScenario(actor, "p1", "s1", { name: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("An archived scenario cannot be modified.");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects unknown assets in an update before writing", async () => {
    const { service, update } = build();
    await expect(
      service.updateScenario(actor, "p1", "s1", {
        changes: [{ assetId: "ghost", percentChange: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationFailedError);
    expect(update).not.toHaveBeenCalled();
  });

  it("archives a scenario, and is idempotent when it is already archived", async () => {
    const { service, update } = build({
      scenarios: [scenario("s1"), scenario("s2", { status: ScenarioStatus.ARCHIVED })],
    });
    const first = await service.archiveScenario(actor, "p1", "s1");
    expect(first.alreadyArchived).toBe(false);
    expect(update).toHaveBeenCalledWith("s1", { status: ScenarioStatus.ARCHIVED });

    update.mockClear();
    const second = await service.archiveScenario(actor, "p1", "s2");
    expect(second.alreadyArchived).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("deletes a scenario of an owned portfolio and nothing else", async () => {
    const { service, remove } = build({
      scenarios: [scenario("s1"), scenario("s2", { portfolioId: "p2" })],
      ownedPortfolios: ["p1", "p2"],
    });
    await service.deleteScenario(actor, "p1", "s1");
    expect(remove).toHaveBeenCalledWith("s1");
    await expect(service.deleteScenario(actor, "p1", "s2")).rejects.toBeInstanceOf(NotFoundError);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe("scenario service archived portfolio guard (ADR-010 point 5)", () => {
  const archivedMessage = "An archived portfolio cannot be modified.";

  it("refuses to create a scenario in an archived portfolio and writes nothing", async () => {
    const { service, create, getAssetsByIds } = build({ archivedPortfolios: ["p1"] });
    const error = await service
      .createScenario(actor, "p1", { name: "New" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe(archivedMessage);
    expect(create).not.toHaveBeenCalled();
    expect(getAssetsByIds).not.toHaveBeenCalled();
  });

  it("refuses to update a scenario of an archived portfolio and writes nothing", async () => {
    const { service, update } = build({ archivedPortfolios: ["p1"] });
    const error = await service
      .updateScenario(actor, "p1", "s1", { name: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe(archivedMessage);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to archive a scenario of an archived portfolio, even one already archived", async () => {
    const { service, update } = build({
      scenarios: [scenario("s1"), scenario("s2", { status: ScenarioStatus.ARCHIVED })],
      archivedPortfolios: ["p1"],
    });
    for (const id of ["s1", "s2"]) {
      const error = await service.archiveScenario(actor, "p1", id).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(archivedMessage);
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to delete a scenario of an archived portfolio and writes nothing", async () => {
    const { service, remove } = build({ archivedPortfolios: ["p1"] });
    const error = await service.deleteScenario(actor, "p1", "s1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe(archivedMessage);
    expect(remove).not.toHaveBeenCalled();
  });

  it("still lists, reads and calculates the scenarios of an archived portfolio", async () => {
    const { service } = build({ archivedPortfolios: ["p1"] });
    expect(await service.listScenarios(actor, "p1", {})).toHaveLength(1);
    expect((await service.getScenarioById(actor, "p1", "s1")).id).toBe("s1");
    await expect(service.calculateScenario(actor, "p1", "s1")).resolves.toBeDefined();
  });

  it("keeps answering 404 for a portfolio of another user, archived or not", async () => {
    const { service } = build({ ownedPortfolios: [], archivedPortfolios: ["p1"] });
    await expect(service.deleteScenario(actor, "p1", "s1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("scenario service permissions", () => {
  it("needs scenario:read for reads and scenario:write for writes", async () => {
    const without = (permission: string): RolePermissions => ({
      USER: new Set(PERMISSIONS.filter((p) => p !== permission)),
      ADMIN: new Set(PERMISSIONS),
    });

    const noRead = build({ permissions: without("scenario:read") }).service;
    await expect(noRead.listScenarios(actor, "p1", {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noRead.getScenarioById(actor, "p1", "s1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noRead.calculateScenario(actor, "p1", "s1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(noRead.compareScenarios(actor, "p1", ["s1"])).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    const noWrite = build({ permissions: without("scenario:write") }).service;
    await expect(noWrite.createScenario(actor, "p1", { name: "x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(noWrite.updateScenario(actor, "p1", "s1", {})).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(noWrite.archiveScenario(actor, "p1", "s1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noWrite.deleteScenario(actor, "p1", "s1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
