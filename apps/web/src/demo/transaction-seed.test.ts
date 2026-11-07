import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Listed<T> {
  data: T[];
}

interface Trade {
  type: string;
  quantity: string | number;
  price: { amount: string };
  executedAt: string;
}

async function historyOf(now: string) {
  const clock = fixedClock(new Date(now));
  const client = createDemoTradingClient({ composition: await createDemoComposition({ clock }) });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });

  const portfolios = (await client.call(op("listPortfolios"))) as Listed<{
    id: string;
    name: string;
  }>;

  const history: Record<string, { trades: Trade[]; positions: number }> = {};
  for (const portfolio of portfolios.data) {
    const params = { portfolioId: portfolio.id };
    const trades = (await client.call(op("listTransactions"), { params })) as Listed<Trade>;
    const positions = (await client.call(op("listPositions"), { params })) as Listed<unknown>;
    history[portfolio.name] = {
      trades: trades.data.map(({ type, quantity, price, executedAt }) => ({
        type,
        quantity,
        price: { amount: price.amount },
        executedAt,
      })),
      positions: positions.data.length,
    };
  }
  return history;
}

describe("demo transaction seed", () => {
  it("gives the same history for the same clock", async () => {
    const first = await historyOf("2026-01-31T12:00:00Z");
    const second = await historyOf("2026-01-31T12:00:00Z");

    expect(second).toEqual(first);
  });

  it("dates the history from the clock instead of the wall time", async () => {
    const january = await historyOf("2026-01-31T12:00:00Z");
    const june = await historyOf("2026-06-30T12:00:00Z");

    expect(june.Crypto?.trades.map((trade) => trade.executedAt)).not.toEqual(
      january.Crypto?.trades.map((trade) => trade.executedAt),
    );
  });

  it("opens three portfolios, two of them with sales, all through the real use case", async () => {
    const history = await historyOf("2026-01-31T12:00:00Z");

    expect(Object.keys(history)).toEqual(["Long-term growth", "Dividend income", "Crypto"]);
    expect(history["Long-term growth"]?.trades).toHaveLength(3);
    expect(history["Dividend income"]?.trades.filter((t) => t.type === "SELL")).toHaveLength(2);
    expect(history.Crypto?.trades.filter((t) => t.type === "SELL")).toHaveLength(2);
    expect(history["Dividend income"]?.positions).toBe(2);
    expect(history.Crypto?.positions).toBe(2);
  });
});
