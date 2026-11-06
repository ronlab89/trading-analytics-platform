import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Page<T> {
  data: T[];
  meta: { total: number };
}

let client: TradingClient;
let portfolioId: string;
let aaplId: string;

beforeEach(async () => {
  const clock = fixedClock(new Date("2026-01-31T12:00:00Z"));
  client = createDemoTradingClient({ composition: await createDemoComposition({ clock }) });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
  const assets = (await client.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };
  aaplId = assets.data[0]?.id ?? "";
});

const buy = (quantity: number) => ({
  assetId: aaplId,
  type: "BUY",
  quantity,
  price: { amount: "190.00", currency: "USD" },
});

async function positions() {
  return (await client.call(op("listPositions"), { params: { portfolioId } })) as {
    data: { id: string; assetId: string; quantity: string | number }[];
  };
}

describe("transaction handlers", () => {
  it("opens the demo portfolio with three seeded purchases and their positions", async () => {
    const listed = (await client.call(op("listTransactions"), {
      params: { portfolioId },
    })) as Page<{ type: string }>;

    expect(listed.meta.total).toBe(3);
    expect(listed.data.every((transaction) => transaction.type === "BUY")).toBe(true);
    expect((await positions()).data).toHaveLength(3);
  });

  it("records a purchase, answers 201 data and moves the position", async () => {
    const created = await client.call(op("createTransaction"), {
      params: { portfolioId },
      body: buy(5),
    });

    expect(created).toMatchObject({ data: { transaction: { type: "BUY", assetId: aaplId } } });
    const aapl = (await positions()).data.find((position) => position.assetId === aaplId);
    expect(Number(aapl?.quantity)).toBe(25);
  });

  it("filters by type and pages the list", async () => {
    await client.call(op("createTransaction"), {
      params: { portfolioId },
      body: { ...buy(5), type: "SELL" },
    });

    const sells = (await client.call(op("listTransactions"), {
      params: { portfolioId },
      query: { type: "SELL", page: 1, pageSize: 10 },
    })) as Page<{ type: string }>;

    expect(sells.meta.total).toBe(1);
  });

  it("refuses a sale of more than is held as 400 and leaves the position as it was", async () => {
    await expect(
      client.call(op("createTransaction"), {
        params: { portfolioId },
        body: { ...buy(500), type: "SELL" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    const aapl = (await positions()).data.find((position) => position.assetId === aaplId);
    expect(Number(aapl?.quantity)).toBe(20);
  });

  it("refuses a missing quantity and an unknown portfolio", async () => {
    await expect(
      client.call(op("createTransaction"), {
        params: { portfolioId },
        body: { assetId: aaplId, type: "BUY", price: { amount: "1", currency: "USD" } },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(
      client.call(op("listTransactions"), { params: { portfolioId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("gets a transaction and a position by id and answers 404 for unknown ones", async () => {
    const [first] = (
      (await client.call(op("listTransactions"), { params: { portfolioId } })) as Page<{
        id: string;
      }>
    ).data;
    const [position] = (await positions()).data;

    await expect(
      client.call(op("getTransaction"), {
        params: { portfolioId, transactionId: first?.id ?? "" },
      }),
    ).resolves.toMatchObject({ data: { id: first?.id } });
    await expect(
      client.call(op("getPosition"), { params: { portfolioId, positionId: position?.id ?? "" } }),
    ).resolves.toMatchObject({ data: { position: { id: position?.id } } });
    await expect(
      client.call(op("getTransaction"), { params: { portfolioId, transactionId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("idempotent creation", () => {
  it("replays the stored answer for the same key and request, without a second purchase", async () => {
    const call = { params: { portfolioId }, body: buy(5), idempotencyKey: "key-1" };

    const first = await client.call(op("createTransaction"), call);
    const second = await client.call(op("createTransaction"), call);

    expect(second).toEqual(first);
    const listed = (await client.call(op("listTransactions"), {
      params: { portfolioId },
    })) as Page<unknown>;
    expect(listed.meta.total).toBe(4);
  });

  it("refuses the same key with another request as a conflict", async () => {
    await client.call(op("createTransaction"), {
      params: { portfolioId },
      body: buy(5),
      idempotencyKey: "key-2",
    });

    await expect(
      client.call(op("createTransaction"), {
        params: { portfolioId },
        body: buy(6),
        idempotencyKey: "key-2",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("frees the key after a failure so the retry can run", async () => {
    const bad = {
      params: { portfolioId },
      body: { ...buy(500), type: "SELL" },
      idempotencyKey: "k3",
    };
    await expect(client.call(op("createTransaction"), bad)).rejects.toMatchObject({ status: 400 });

    await expect(
      client.call(op("createTransaction"), { ...bad, body: buy(1) }),
    ).resolves.toBeDefined();
  });
});
