import { describe, expect, it, vi } from "vitest";
import { AlertType, InvalidAlertError, PortfolioStatus } from "@trading/domain";
import type { Alert } from "@trading/domain";
import type { Actor } from "./actor.js";
import { createAlertService } from "./alert-service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "TRADER" };

function alert(id: string, userId = "u1"): Alert {
  return {
    id,
    userId,
    assetId: "a1",
    portfolioId: null,
    type: AlertType.PRICE,
    condition: "ABOVE",
    threshold: 100,
    enabled: true,
    armed: true,
    lastTriggeredAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

interface Options {
  stored?: Alert[];
  assetExists?: boolean;
  ownedPortfolios?: string[];
  archivedPortfolios?: string[];
  permissions?: RolePermissions;
}

function build(options: Options = {}) {
  const {
    stored = [alert("al1")],
    assetExists = true,
    ownedPortfolios = ["p1"],
    archivedPortfolios = [],
  } = options;

  const create = vi.fn((input: { userId: string }) => Promise.resolve(alert("new", input.userId)));
  const update = vi.fn((id: string, _input: Partial<Alert>) => Promise.resolve(alert(id)));
  const remove = vi.fn((_id: string) => Promise.resolve());
  const getAssetById = vi.fn((_actor: Actor, id: string) =>
    assetExists
      ? Promise.resolve({ id } as never)
      : Promise.reject(new NotFoundError("The requested asset could not be found.")),
  );
  const getPortfolioById = vi.fn((_actor: Actor, portfolioId: string) =>
    ownedPortfolios.includes(portfolioId)
      ? Promise.resolve({
          status: archivedPortfolios.includes(portfolioId)
            ? PortfolioStatus.ARCHIVED
            : PortfolioStatus.ACTIVE,
        } as never)
      : Promise.reject(new NotFoundError("The requested resource could not be found.")),
  );

  const service = createAlertService({
    alertRepository: {
      listByUserId: (userId: string) => Promise.resolve(stored.filter((a) => a.userId === userId)),
      getById: (id: string) => Promise.resolve(stored.find((a) => a.id === id) ?? null),
      create,
      update,
      delete: remove,
    },
    assetService: { getAssetById },
    portfolioService: { getPortfolioById },
    ...(options.permissions ? { permissions: options.permissions } : {}),
  });

  return { service, create, update, remove, getAssetById, getPortfolioById };
}

const priceAlert = { type: AlertType.PRICE, condition: "ABOVE", threshold: 100 };

describe("alert service", () => {
  it("lists only the actor's alerts", async () => {
    const { service } = build({ stored: [alert("al1"), alert("al2", "u2")] });
    const result = await service.listAlerts(actor);
    expect(result.map((a) => a.id)).toEqual(["al1"]);
  });

  it("returns one of the actor's alerts", async () => {
    const { service } = build();
    expect((await service.getAlertById(actor, "al1")).id).toBe("al1");
  });

  it("raises NotFoundError for another user's alert", async () => {
    const { service } = build({ stored: [alert("al1", "u2")] });
    const error = await service.getAlertById(actor, "al1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested resource could not be found.");
  });

  it("creates an alert for the actor after checking the asset", async () => {
    const { service, create, getAssetById } = build();
    await service.createAlert(actor, { ...priceAlert, assetId: "a1" });
    expect(getAssetById).toHaveBeenCalledWith(actor, "a1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", assetId: "a1" }));
  });

  it("checks that a referenced portfolio belongs to the actor", async () => {
    const { service, create } = build({ ownedPortfolios: [] });
    await expect(
      service.createAlert(actor, { ...priceAlert, portfolioId: "p9" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(create).not.toHaveBeenCalled();
  });

  it("raises the asset's not-found for an unknown asset and writes nothing", async () => {
    const { service, create } = build({ assetExists: false });
    const error = await service
      .createAlert(actor, { ...priceAlert, assetId: "ghost" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("The requested asset could not be found.");
    expect(create).not.toHaveBeenCalled();
  });

  it("enforces the domain invariants after the lookups and writes nothing on failure", async () => {
    const { service, create } = build();
    await expect(service.createAlert(actor, priceAlert)).rejects.toBeInstanceOf(InvalidAlertError);
    expect(create).not.toHaveBeenCalled();
  });

  it("updates an alert of the actor with the given fields only", async () => {
    const { service, update } = build();
    await service.updateAlert(actor, "al1", { enabled: false });
    expect(update).toHaveBeenCalledWith("al1", { enabled: false });
  });

  it("does not update or delete another user's alert", async () => {
    const { service, update, remove } = build({ stored: [alert("al1", "u2")] });
    await expect(service.updateAlert(actor, "al1", { enabled: false })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(service.deleteAlert(actor, "al1")).rejects.toBeInstanceOf(NotFoundError);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes an alert of the actor", async () => {
    const { service, remove } = build();
    await service.deleteAlert(actor, "al1");
    expect(remove).toHaveBeenCalledWith("al1");
  });

  describe("archived portfolio guard (ADR-010 point 5)", () => {
    const inP1 = { ...alert("al1"), portfolioId: "p1" };
    const message = "An archived portfolio cannot be modified.";

    it("rejects creating an alert in an archived portfolio before looking up the asset", async () => {
      const { service, create, getAssetById } = build({ archivedPortfolios: ["p1"] });
      const error = await service
        .createAlert(actor, { ...priceAlert, assetId: "a1", portfolioId: "p1" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(message);
      expect(getAssetById).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects updating and deleting an alert of an archived portfolio", async () => {
      const { service, update, remove } = build({ stored: [inP1], archivedPortfolios: ["p1"] });
      const updated = await service
        .updateAlert(actor, "al1", { enabled: false })
        .catch((e: unknown) => e);
      const deleted = await service.deleteAlert(actor, "al1").catch((e: unknown) => e);
      expect(updated).toBeInstanceOf(ConflictError);
      expect(deleted).toBeInstanceOf(ConflictError);
      expect((deleted as Error).message).toBe(message);
      expect(update).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it("still writes alerts of an active portfolio and alerts without a portfolio", async () => {
      const { service, update, remove, getPortfolioById } = build({ stored: [inP1, alert("al2")] });
      await service.updateAlert(actor, "al1", { enabled: false });
      await service.deleteAlert(actor, "al1");
      await service.deleteAlert(actor, "al2");
      expect(update).toHaveBeenCalledWith("al1", { enabled: false });
      expect(remove).toHaveBeenCalledTimes(2);
      expect(getPortfolioById).toHaveBeenCalledTimes(2);
    });

    it("keeps answering 404 for another user's alert of an archived portfolio", async () => {
      const { service } = build({
        stored: [{ ...inP1, userId: "u2" }],
        archivedPortfolios: ["p1"],
      });
      await expect(service.deleteAlert(actor, "al1")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("needs alert:read for reads and alert:write for writes", async () => {
    const without = (permission: string): RolePermissions => ({
      TRADER: new Set(PERMISSIONS.filter((p) => p !== permission)),
      VIEWER: new Set(PERMISSIONS),
      ADMIN: new Set(PERMISSIONS),
    });

    const noRead = build({ permissions: without("alert:read") }).service;
    await expect(noRead.listAlerts(actor)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noRead.getAlertById(actor, "al1")).rejects.toBeInstanceOf(ForbiddenError);

    const noWrite = build({ permissions: without("alert:write") }).service;
    await expect(
      noWrite.createAlert(actor, { ...priceAlert, assetId: "a1" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noWrite.updateAlert(actor, "al1", {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(noWrite.deleteAlert(actor, "al1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
