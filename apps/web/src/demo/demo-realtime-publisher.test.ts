import { fixedClock } from "@trading/application";
import { API_OPERATIONS, realtimeEventSchema } from "@trading/contracts";
import type { RealtimeChannel, RealtimeEvent } from "@trading/contracts";
import { Money } from "@trading/domain";
import { afterEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createWebSocketRealtimeClient } from "@/realtime/websocket-realtime-client";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import type { DemoComposition } from "./demo-composition";
import { createDemoRealtimePublisher } from "./demo-realtime-publisher";
import { createDemoRealtimeServer } from "./demo-realtime-server";

const op = (id: string) => findOperation(API_OPERATIONS, id);
const NOW = new Date("2026-01-31T12:00:00Z");
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

let composition: DemoComposition | undefined;

afterEach(async () => {
  await composition?.jobRunner.stop();
});

async function setup() {
  const server = createDemoRealtimeServer({ clock: fixedClock(NOW) });
  const publisher = createDemoRealtimePublisher(server);
  composition = await createDemoComposition({
    clock: fixedClock(NOW),
    realtimePublisher: publisher,
  });
  const tradingClient = createDemoTradingClient({ composition });
  await tradingClient.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const realtime = createWebSocketRealtimeClient({
    url: "demo://realtime",
    getAccessToken: () => "demo-token",
    createSocket: server.createSocket,
  });
  realtime.connect();

  const received: RealtimeEvent[] = [];
  const listen = (channel: RealtimeChannel) => realtime.subscribe(channel, (e) => received.push(e));

  const portfolios = (await tradingClient.call(op("listPortfolios"))) as { data: { id: string }[] };
  const assets = (await tradingClient.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };
  return {
    publisher,
    tradingClient,
    received,
    listen,
    portfolioId: portfolios.data[0]?.id ?? "",
    aaplId: assets.data[0]?.id ?? "",
  };
}

describe("demo realtime publisher", () => {
  it("publishes PORTFOLIO_UPDATED when a transaction is committed", async () => {
    const { tradingClient, received, listen, portfolioId, aaplId } = await setup();
    listen({ kind: "portfolio", portfolioId });
    await flush();

    await tradingClient.call(op("createTransaction"), {
      params: { portfolioId },
      body: {
        assetId: aaplId,
        type: "BUY",
        quantity: 1,
        price: { amount: "190.00", currency: "USD" },
      },
    });
    await flush();

    expect(received).toEqual([
      expect.objectContaining({
        type: "PORTFOLIO_UPDATED",
        channel: `portfolio:${portfolioId}`,
        payload: { portfolioId, reason: "TRANSACTION_COMMITTED" },
      }),
    ]);
  });

  it("publishes the job, the portfolio and the notification when an import completes", async () => {
    const { tradingClient, received, listen, portfolioId } = await setup();
    listen({ kind: "portfolio", portfolioId });
    listen({ kind: "notifications" });
    await flush();
    composition?.jobRunner.start();

    const job = (await tradingClient.call(op("importTransactions"), {
      params: { portfolioId },
      body: "symbol,type,quantity,price,fees,executedAt\nAAPL,BUY,1,190,,2026-01-20",
    })) as { data: { id: string } };
    for (let attempt = 0; attempt < 200 && received.length < 2; attempt += 1) await flush();

    expect(received.map((event) => event.type).sort()).toEqual([
      "NOTIFICATION_CREATED",
      "PORTFOLIO_UPDATED",
    ]);
    expect(received).toContainEqual(
      expect.objectContaining({ payload: { portfolioId, reason: "IMPORT_COMMITTED" } }),
    );
    expect(job.data.id).not.toBe("");
  });

  it("publishes the market tick and the fired alert in the shape of the contract", async () => {
    const { publisher, received, listen } = await setup();
    listen({ kind: "market", assetId: "asset1" });
    listen({ kind: "notifications" });
    await flush();
    const usd = (amount: string) => Money.of(amount, "USD");

    await publisher.marketPriceUpdated({
      assetId: "asset1",
      price: usd("101.00"),
      previousPrice: usd("100.00"),
      change: usd("1.00"),
      changePercent: 1,
      tickChange: usd("0.10"),
    });
    await publisher.alertTriggered({
      alertId: "alert1",
      userId: "demo-user",
      assetId: "asset1",
      condition: "ABOVE",
      threshold: usd("100.00"),
      price: usd("101.00"),
    });
    await flush();

    expect(received.map((event) => event.type)).toEqual([
      "MARKET_PRICE_UPDATED",
      "ALERT_TRIGGERED",
    ]);
    expect(received.every((event) => realtimeEventSchema.safeParse(event).success)).toBe(true);
    expect(received[0]).toMatchObject({
      payload: { price: { amount: "101", currency: "USD" } },
    });
  });
});
