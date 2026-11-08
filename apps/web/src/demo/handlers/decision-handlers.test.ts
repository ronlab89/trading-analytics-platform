import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Decision {
  id: string;
  title: string;
  direction: string;
  closedAt: string | null;
}

let client: TradingClient;
let portfolioId: string;

beforeEach(async () => {
  const composition = await createDemoComposition({
    clock: fixedClock(new Date("2026-01-31T12:00:00Z")),
  });
  client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
});

async function listDecisions(query: Record<string, string> = {}) {
  const result = (await client.call(op("listDecisions"), {
    params: { portfolioId },
    query,
  })) as { data: Decision[] };
  return result.data;
}

describe("decision handlers", () => {
  it("lists the two seeded decisions, newest first", async () => {
    const decisions = await listDecisions();

    expect(decisions.map((decision) => decision.direction)).toEqual(["SHORT", "LONG"]);
  });

  it("filters by direction", async () => {
    const decisions = await listDecisions({ direction: "LONG" });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.closedAt).toBeNull();
  });

  it("gets one decision and answers 404 for one that does not exist", async () => {
    const [first] = await listDecisions();

    await expect(
      client.call(op("getDecision"), { params: { portfolioId, decisionId: first?.id ?? "" } }),
    ).resolves.toMatchObject({ data: { id: first?.id } });
    await expect(
      client.call(op("getDecision"), { params: { portfolioId, decisionId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("replays the history of a decision, event by event", async () => {
    const closed = (await listDecisions()).find((decision) => decision.closedAt !== null);

    const replay = (await client.call(op("getDecisionReplay"), {
      params: { decisionId: closed?.id ?? "" },
    })) as { data: { events: unknown[] } };

    expect(replay.data.events).toHaveLength(6);
  });
});
