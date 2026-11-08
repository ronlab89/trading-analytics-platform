import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";
import { roleOfDemoEmail } from "./auth-handlers";

const op = (id: string) => findOperation(API_OPERATIONS, id);

let client: TradingClient;

beforeEach(async () => {
  const composition = await createDemoComposition({
    clock: fixedClock(new Date("2026-01-31T12:00:00Z")),
  });
  client = createDemoTradingClient({ composition });
});

const signInAs = (name: string) =>
  client.call(op("login"), { body: { email: `${name}@demo.example`, password: "demo" } });

describe("roleOfDemoEmail", () => {
  it("reads the role from the name of the email and defaults to the trader", () => {
    expect(roleOfDemoEmail("viewer@demo.example")).toBe("VIEWER");
    expect(roleOfDemoEmail("ADMIN@demo.example")).toBe("ADMIN");
    expect(roleOfDemoEmail("trader@demo.example")).toBe("TRADER");
    expect(roleOfDemoEmail("someone@example.com")).toBe("TRADER");
  });
});

describe("demo roles", () => {
  it("signs in with the role asked for, and the current user reflects it", async () => {
    await expect(signInAs("viewer")).resolves.toMatchObject({ data: { user: { role: "VIEWER" } } });
    await expect(client.call(op("getCurrentUser"))).resolves.toMatchObject({
      data: { user: { role: "VIEWER" } },
    });
  });

  it("lets a viewer read but not write", async () => {
    await signInAs("viewer");
    const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };

    await expect(client.call(op("listPortfolios"))).resolves.toBeDefined();
    await expect(
      client.call(op("createPortfolio"), { body: { name: "Mine", baseCurrency: "USD" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      client.call(op("listDecisions"), { params: { portfolioId: portfolios.data[0]?.id ?? "" } }),
    ).resolves.toBeDefined();
  });

  it("lets only an administrator control the simulation", async () => {
    await signInAs("trader");
    await expect(client.call(op("pauseSimulation"))).rejects.toMatchObject({ status: 403 });

    await signInAs("admin");
    await expect(client.call(op("pauseSimulation"))).resolves.toMatchObject({
      data: { state: "HALTED" },
    });
  });
});
