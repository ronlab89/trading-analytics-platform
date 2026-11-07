import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Scenario {
  id: string;
  name: string;
  status: string;
}

async function openDemo(now = "2026-01-31T12:00:00Z") {
  const composition = await createDemoComposition({ clock: fixedClock(new Date(now)) });
  const client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  const portfolioId = portfolios.data[0]?.id ?? "";
  const listed = (await client.call(op("listScenarios"), { params: { portfolioId } })) as {
    data: Scenario[];
  };
  return { client, portfolioId, scenarios: listed.data };
}

describe("demo scenario seed", () => {
  it("opens with three scenarios on the first portfolio, two saved and one draft", async () => {
    const { scenarios } = await openDemo();

    expect(scenarios).toHaveLength(3);
    expect(scenarios.filter((scenario) => scenario.status === "SAVED")).toHaveLength(2);
    expect(scenarios.filter((scenario) => scenario.status === "DRAFT")).toHaveLength(1);
  });

  it("calculates every seeded scenario on the held positions, with nothing unmatched", async () => {
    const { client, portfolioId, scenarios } = await openDemo();

    for (const scenario of scenarios) {
      const result = (await client.call(op("calculateScenario"), {
        params: { portfolioId, scenarioId: scenario.id },
      })) as { data: { unmatchedAssetIds: string[] } };

      expect(result.data.unmatchedAssetIds).toEqual([]);
    }
  });

  it("gives the same scenarios for the same clock", async () => {
    const strip = (scenarios: Scenario[]) =>
      scenarios
        .map(({ name, status }) => ({ name, status }))
        .sort((a, b) => a.name.localeCompare(b.name));

    expect(strip((await openDemo()).scenarios)).toEqual(strip((await openDemo()).scenarios));
  });
});
