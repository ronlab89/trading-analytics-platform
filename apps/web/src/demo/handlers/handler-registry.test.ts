import { API_OPERATIONS } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { createDemoComposition } from "../demo-composition";
import { createAuthHandlers } from "./auth-handlers";
import type { HandlerContext, HandlerRegistry } from "./handler";
import { createMarketHandlers } from "./market-handlers";
import { createPortfolioHandlers } from "./portfolio-handlers";
import { createWatchlistHandlers } from "./watchlist-handlers";

const factories: Record<string, (context: HandlerContext) => HandlerRegistry> = {
  auth: createAuthHandlers,
  portfolios: createPortfolioHandlers,
  market: createMarketHandlers,
  watchlist: createWatchlistHandlers,
};

describe("demo handler registry", () => {
  it("only serves operations that exist in the contract, each once", async () => {
    const composition = await createDemoComposition();
    const context: HandlerContext = {
      composition,
      session: { signedIn: false },
      clock: { now: () => new Date() },
      actor: composition.actor,
    };
    const known = new Set(API_OPERATIONS.map((operation) => operation.operationId));

    const served = Object.values(factories).flatMap((create) => Object.keys(create(context)));

    expect(served.filter((id) => !known.has(id))).toEqual([]);
    expect(new Set(served).size).toBe(served.length);
  });
});
