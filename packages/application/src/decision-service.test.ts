import { describe, expect, it, vi } from "vitest";
import { DecisionDirection, DecisionEventType } from "@trading/domain";
import type { Asset, Decision, DecisionEvent } from "@trading/domain";
import type { Actor } from "./actor.js";
import { createDecisionService } from "./decision-service.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "USER" };

const decision: Decision = {
  id: "d1",
  portfolioId: "p1",
  assetId: "a1",
  title: "Buy AAA",
  thesis: "Strong momentum",
  direction: DecisionDirection.LONG,
  entryPrice: null,
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  closedAt: null,
  outcome: null,
  notes: null,
};

const event: DecisionEvent = {
  id: "e1",
  decisionId: "d1",
  timestamp: new Date("2026-01-01T00:00:00Z"),
  type: DecisionEventType.DECISION_CREATED,
  payload: {},
};

const asset = { id: "a1", currency: "USD" } as Asset;

interface Options {
  decisions?: Decision[];
  ownedPortfolios?: string[];
  assetExists?: boolean;
  permissions?: RolePermissions;
}

function build(options: Options = {}) {
  const { decisions = [decision], ownedPortfolios = ["p1"], assetExists = true } = options;

  const list = vi.fn(() => Promise.resolve(decisions));

  const service = createDecisionService({
    decisionRepository: {
      listByPortfolioId: list,
      getById: (id: string) => Promise.resolve(decisions.find((d) => d.id === id) ?? null),
    },
    decisionEventRepository: { listByDecisionId: () => Promise.resolve([event]) },
    assetRepository: { getById: () => Promise.resolve(assetExists ? asset : null) },
    portfolioService: {
      getPortfolioById: (_actor: Actor, portfolioId: string) =>
        ownedPortfolios.includes(portfolioId)
          ? Promise.resolve({} as never)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, list };
}

describe("decision service", () => {
  it("lists the decisions of an owned portfolio and passes the filter through", async () => {
    const { service, list } = build();
    const result = await service.listDecisions(actor, "p1", { assetId: "a1" });
    expect(result).toEqual([decision]);
    expect(list).toHaveBeenCalledWith("p1", { assetId: "a1" });
  });

  it("does not list decisions of a portfolio the actor does not own", async () => {
    const { service } = build({ ownedPortfolios: [] });
    await expect(service.listDecisions(actor, "p1", {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns one decision scoped to its portfolio", async () => {
    const { service } = build();
    expect(await service.getDecisionById(actor, "p1", "d1")).toEqual(decision);
  });

  it("raises NotFoundError for a decision that belongs to another portfolio", async () => {
    const { service } = build({ ownedPortfolios: ["p1", "p2"] });
    const error = await service.getDecisionById(actor, "p2", "d1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("returns the replay with events, the asset currency and the initial state", async () => {
    const { service } = build();
    const replay = await service.getDecisionReplay(actor, "d1");
    expect(replay.decision).toEqual(decision);
    expect(replay.events).toEqual([event]);
    expect(replay.currency).toBe("USD");
    expect(replay.initialState).toBeDefined();
  });

  it("raises NotFoundError for a replay of an unknown decision", async () => {
    const { service } = build({ decisions: [] });
    await expect(service.getDecisionReplay(actor, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("raises the same NotFoundError for a replay of another user's decision", async () => {
    const { service } = build({ ownedPortfolios: [] });
    const error = await service.getDecisionReplay(actor, "d1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("fails with a plain error, not NotFoundError, when the decision's asset is missing", async () => {
    const { service } = build({ assetExists: false });
    const error = await service.getDecisionReplay(actor, "d1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NotFoundError);
  });

  it("needs decision:read for every use case", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "decision:read")),
      ADMIN: new Set(PERMISSIONS),
    };
    const { service } = build({ permissions: noRead });
    await expect(service.listDecisions(actor, "p1", {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.getDecisionById(actor, "p1", "d1")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.getDecisionReplay(actor, "d1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
