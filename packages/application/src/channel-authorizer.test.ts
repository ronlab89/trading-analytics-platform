import { describe, expect, it } from "vitest";
import type { Job, Portfolio } from "@trading/domain";
import type { Actor } from "./actor.js";
import { createChannelAuthorizer } from "./channel-authorizer.js";
import type { ChannelAuthorizerDependencies } from "./channel-authorizer.js";
import { NotFoundError } from "./errors.js";
import type { RolePermissions } from "./permissions.js";

const owner: Actor = { userId: "u1", role: "TRADER" };
const stranger: Actor = { userId: "u2", role: "TRADER" };

/** Owns portfolio `p1` and job `j1`; every other id reads as missing. */
function build(overrides: Partial<ChannelAuthorizerDependencies> = {}) {
  return createChannelAuthorizer({
    portfolioService: {
      getPortfolioById: (actor, portfolioId) =>
        actor.userId === "u1" && portfolioId === "p1"
          ? Promise.resolve({ id: "p1", userId: "u1" } as Portfolio)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    jobRepository: {
      getById: (jobId) =>
        Promise.resolve(jobId === "j1" ? ({ id: "j1", userId: "u1" } as Job) : null),
    },
    ...overrides,
  });
}

describe("createChannelAuthorizer", () => {
  it("lets any authenticated actor subscribe to a market channel", async () => {
    const authorizer = build();

    expect(await authorizer.canSubscribe(owner, { kind: "market", assetId: "a1" })).toBe(true);
    expect(
      await authorizer.canSubscribe(
        { userId: "u3", role: "VIEWER" },
        { kind: "market", assetId: "a1" },
      ),
    ).toBe(true);
  });

  it("lets an actor subscribe to the notifications channel, which is always their own", async () => {
    expect(await build().canSubscribe(stranger, { kind: "notifications" })).toBe(true);
  });

  it("lets the owner subscribe to a portfolio and refuses everyone else", async () => {
    const authorizer = build();
    const channel = { kind: "portfolio", portfolioId: "p1" } as const;

    expect(await authorizer.canSubscribe(owner, channel)).toBe(true);
    expect(await authorizer.canSubscribe(stranger, channel)).toBe(false);
  });

  it("refuses a portfolio that does not exist exactly like one of another user", async () => {
    const authorizer = build();

    expect(
      await authorizer.canSubscribe(owner, { kind: "portfolio", portfolioId: "missing" }),
    ).toBe(false);
  });

  it("lets the owner subscribe to a job and refuses everyone else", async () => {
    const authorizer = build();
    const channel = { kind: "jobs", jobId: "j1" } as const;

    expect(await authorizer.canSubscribe(owner, channel)).toBe(true);
    expect(await authorizer.canSubscribe(stranger, channel)).toBe(false);
  });

  it("refuses a job that does not exist exactly like one of another user", async () => {
    expect(await build().canSubscribe(owner, { kind: "jobs", jobId: "missing" })).toBe(false);
  });

  it("refuses a channel whose permission the role lacks", async () => {
    const none: RolePermissions = {
      VIEWER: new Set(),
      TRADER: new Set(),
      ADMIN: new Set(),
    };
    const authorizer = build({ permissions: none });

    expect(await authorizer.canSubscribe(owner, { kind: "market", assetId: "a1" })).toBe(false);
    expect(await authorizer.canSubscribe(owner, { kind: "notifications" })).toBe(false);
  });

  it("does not hide an infrastructure failure behind a refusal", async () => {
    const authorizer = build({
      portfolioService: { getPortfolioById: () => Promise.reject(new Error("db down")) },
    });

    await expect(
      authorizer.canSubscribe(owner, { kind: "portfolio", portfolioId: "p1" }),
    ).rejects.toThrow("db down");
  });
});
