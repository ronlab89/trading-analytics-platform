import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Scenario {
  id: string;
  name: string;
  status: string;
}

let client: TradingClient;
let portfolioId: string;
let aaplId: string;

beforeEach(async () => {
  const composition = await createDemoComposition({
    clock: fixedClock(new Date("2026-01-31T12:00:00Z")),
  });
  client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
  const assets = (await client.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };
  aaplId = assets.data[0]?.id ?? "";
});

async function createScenario(name: string, percentChange = -10) {
  const created = (await client.call(op("createScenario"), {
    params: { portfolioId },
    body: { name, changes: [{ assetId: aaplId, percentChange }] },
  })) as { data: Scenario };
  return created.data;
}

describe("scenario handlers", () => {
  it("creates, lists, gets, updates and deletes a scenario", async () => {
    const scenario = await createScenario("Apple falls");
    const params = { portfolioId, scenarioId: scenario.id };

    const listed = (await client.call(op("listScenarios"), { params: { portfolioId } })) as {
      data: Scenario[];
    };
    expect(listed.data).toContainEqual(
      expect.objectContaining({ id: scenario.id, name: "Apple falls" }),
    );
    await expect(client.call(op("getScenario"), { params })).resolves.toMatchObject({
      data: { id: scenario.id },
    });
    await expect(
      client.call(op("updateScenario"), { params, body: { name: "Apple drops" } }),
    ).resolves.toMatchObject({ data: { name: "Apple drops" } });
    await expect(client.call(op("deleteScenario"), { params })).resolves.toBeUndefined();
    const remaining = (await client.call(op("listScenarios"), { params: { portfolioId } })) as {
      data: Scenario[];
    };
    expect(remaining.data.map((listedScenario) => listedScenario.id)).not.toContain(scenario.id);
  });

  it("refuses a change on an asset that does not exist", async () => {
    await expect(
      client.call(op("createScenario"), {
        params: { portfolioId },
        body: { name: "Ghost", changes: [{ assetId: "missing", percentChange: 5 }] },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("calculates the impact on the current positions without writing anything", async () => {
    const scenario = await createScenario("Apple falls", -10);

    const result = (await client.call(op("calculateScenario"), {
      params: { portfolioId, scenarioId: scenario.id },
    })) as { data: { difference: { totalValue: unknown }; unmatchedAssetIds: string[] } };

    expect(result.data.difference).toHaveProperty("totalValue");
    expect(result.data.unmatchedAssetIds).toEqual([]);
  });

  it("archives once and reports it when it is already archived", async () => {
    const scenario = await createScenario("Old idea");
    const params = { portfolioId, scenarioId: scenario.id };

    await expect(client.call(op("archiveScenario"), { params })).resolves.toMatchObject({
      data: { status: "ARCHIVED" },
      meta: { alreadyArchived: false },
    });
    await expect(client.call(op("archiveScenario"), { params })).resolves.toMatchObject({
      meta: { alreadyArchived: true },
    });
  });

  it("compares two scenarios", async () => {
    const down = await createScenario("Down", -10);
    const up = await createScenario("Up", 10);

    await expect(
      client.call(op("compareScenarios"), {
        params: { portfolioId },
        body: { scenarioIds: [down.id, up.id] },
      }),
    ).resolves.toHaveProperty("data");
  });

  it("answers 404 for a scenario that does not exist", async () => {
    await expect(
      client.call(op("getScenario"), { params: { portfolioId, scenarioId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
