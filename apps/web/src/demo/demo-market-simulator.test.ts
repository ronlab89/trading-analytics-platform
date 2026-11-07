import { fixedClock } from "@trading/application";
import type { RealtimePublisher } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import type { DemoComposition } from "./demo-composition";
import { TICK_INTERVAL_MS } from "./demo-market-simulator";
import type { Scheduler } from "./demo-market-simulator";

const op = (id: string) => findOperation(API_OPERATIONS, id);
const NOW = new Date("2026-01-31T12:00:00Z");

let composition: DemoComposition | undefined;

afterEach(async () => {
  await composition?.marketSimulator.stop();
});

interface Published {
  assetId: string;
  price: string;
}

async function setup(options: { isVisible?: () => boolean } = {}) {
  const published: Published[] = [];
  const publisher = {
    marketPriceUpdated: (tick) => {
      published.push({ assetId: tick.assetId, price: tick.price.toString() });
      return Promise.resolve();
    },
  } as RealtimePublisher;

  let task: (() => Promise<void>) | undefined;
  let interval: number | undefined;
  let stopped = false;
  const scheduler: Scheduler = {
    every: (intervalMs, run) => {
      interval = intervalMs;
      task = run;
      return {
        stop: () => {
          stopped = true;
        },
      };
    },
  };

  composition = await createDemoComposition({
    clock: fixedClock(NOW),
    realtimePublisher: publisher,
    marketSimulation: { scheduler, ...options },
  });
  const client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const assets = (await client.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };

  return {
    composition,
    client,
    published,
    aaplId: assets.data[0]?.id ?? "",
    interval: () => interval,
    isStopped: () => stopped,
    isScheduled: () => task !== undefined,
    fire: async () => {
      await task?.();
    },
  };
}

async function aaplPrice(client: Awaited<ReturnType<typeof setup>>["client"], assetId: string) {
  const answer = (await client.call(op("getAssetPrice"), { params: { assetId } })) as {
    data: { price: { amount: string } };
  };
  return answer.data.price.amount;
}

describe("demo market simulator", () => {
  it("ticks once per second and does nothing before the first tick", async () => {
    const { composition: demo, published, interval, isScheduled } = await setup();

    await demo.marketSimulator.start();

    expect(isScheduled()).toBe(true);
    expect(interval()).toBe(TICK_INTERVAL_MS);
    expect(published).toEqual([]);
  });

  it("publishes one price per asset at each tick", async () => {
    const { composition: demo, published, aaplId, fire } = await setup();
    await demo.marketSimulator.start();

    await fire();

    const assetIds = new Set(published.map((tick) => tick.assetId));
    expect(published).toHaveLength(assetIds.size);
    expect(assetIds.has(aaplId)).toBe(true);
  });

  it("stores the price and moves the positions with it", async () => {
    const { composition: demo, client, published, aaplId, fire } = await setup();
    const before = await aaplPrice(client, aaplId);
    await demo.marketSimulator.start();

    for (let tick = 0; tick < 10; tick += 1) await fire();

    const last = published.filter((tick) => tick.assetId === aaplId).at(-1)?.price;
    expect(last).not.toBe(before);
    expect(await aaplPrice(client, aaplId)).toBe(last);
    const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
    const positions = (await client.call(op("listPositions"), {
      params: { portfolioId: portfolios.data[0]?.id ?? "" },
    })) as { data: { assetId: string; currentPrice: { amount: string } }[] };
    expect(
      positions.data.find((position) => position.assetId === aaplId)?.currentPrice.amount,
    ).toBe(last);
  });

  it("skips the ticks while the administrator has halted it, and resumes", async () => {
    const { composition: demo, published, fire } = await setup();
    await demo.marketSimulator.start();

    demo.simulationControl.pause();
    await fire();
    expect(published).toEqual([]);

    demo.simulationControl.start();
    await fire();
    expect(published.length).toBeGreaterThan(0);
  });

  it("gives the mode of the control to the engine: PAUSED stops the prices", async () => {
    const { composition: demo, published, fire } = await setup();
    await demo.marketSimulator.start();

    demo.simulationControl.setMode("PAUSED");
    await fire();

    expect(published).toEqual([]);
  });

  it("skips the ticks while the tab is hidden", async () => {
    let visible = false;
    const { composition: demo, published, fire } = await setup({ isVisible: () => visible });
    await demo.marketSimulator.start();

    await fire();
    expect(published).toEqual([]);

    visible = true;
    await fire();
    expect(published.length).toBeGreaterThan(0);
  });

  it("gives the same prices for the same clock", async () => {
    const run = async () => {
      const { composition: demo, published, fire } = await setup();
      await demo.marketSimulator.start();
      await fire();
      await fire();
      await demo.marketSimulator.stop();
      return published.map((tick) => `${tick.assetId}:${tick.price}`);
    };

    const first = await run();
    const second = await run();

    expect(first.length).toBeGreaterThan(0);
    expect(second.map((entry) => entry.split(":")[1])).toEqual(
      first.map((entry) => entry.split(":")[1]),
    );
  });

  it("stops the timer on stop and does not start again afterwards", async () => {
    const { composition: demo, isStopped } = await setup();
    await demo.marketSimulator.start();

    await demo.marketSimulator.stop();

    expect(isStopped()).toBe(true);
  });
});
