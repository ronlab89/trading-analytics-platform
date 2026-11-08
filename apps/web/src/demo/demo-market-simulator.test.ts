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
  /** The alert and notification events, in the order they were published. */
  const events: string[] = [];
  const publisher: RealtimePublisher = {
    marketPriceUpdated: (tick) => {
      published.push({ assetId: tick.assetId, price: tick.price.toString() });
      return Promise.resolve();
    },
    alertTriggered: () => {
      events.push("ALERT_TRIGGERED");
      return Promise.resolve();
    },
    notificationCreated: () => {
      events.push("NOTIFICATION_CREATED");
      return Promise.resolve();
    },
    portfolioUpdated: () => Promise.resolve(),
    jobProgressUpdated: () => Promise.resolve(),
    jobCompleted: () => Promise.resolve(),
    jobFailed: () => Promise.resolve(),
  };

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
    events,
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

  describe("alert firing", () => {
    /** The AAPL prices of the first ticks: the same clock and seed always give the same series. */
    async function aaplSeries(ticks: number) {
      const run = await setup();
      await run.composition.marketSimulator.start();
      const series: string[] = [];
      for (let tick = 0; tick < ticks; tick += 1) {
        const before = run.published.length;
        await run.fire();
        const published = run.published.slice(before).find((entry) => entry.assetId === run.aaplId);
        series.push(published?.price ?? "");
      }
      await run.composition.marketSimulator.stop();
      return series;
    }

    // The rule is edge-triggered (ADR-007 point 9): an alert fires when its price crosses the
    // threshold, so the test creates it while its condition is false, just before the first move.
    async function crossing() {
      const series = await aaplSeries(40);
      const first = series[0] ?? "";
      const moved = series.findIndex((price) => price !== first);
      expect(moved).toBeGreaterThan(0);
      const direction = Number(series[moved]) > Number(first) ? "ABOVE" : "BELOW";
      return { first, moved, direction };
    }

    it("fires when the price crosses the threshold, with its notification and both events", async () => {
      const { first, moved, direction } = await crossing();
      const { composition: demo, client, events, aaplId, fire } = await setup();
      await demo.marketSimulator.start();
      await fire();
      await client.call(op("createAlert"), {
        body: { assetId: aaplId, type: "PRICE", condition: direction, threshold: Number(first) },
      });

      for (let tick = 1; tick < moved; tick += 1) await fire();
      expect(events).toEqual([]);
      await fire();

      expect([...events].sort()).toEqual(["ALERT_TRIGGERED", "NOTIFICATION_CREATED"]);
      const notifications = (await client.call(op("listNotifications"))) as {
        data: { type: string }[];
      };
      expect(notifications.data.filter((n) => n.type === "ALERT_TRIGGERED")).toHaveLength(1);
    });

    it("does not fire it again on the next tick", async () => {
      const { first, moved, direction } = await crossing();
      const { composition: demo, client, events, aaplId, fire } = await setup();
      await demo.marketSimulator.start();
      await fire();
      await client.call(op("createAlert"), {
        body: { assetId: aaplId, type: "PRICE", condition: direction, threshold: Number(first) },
      });

      for (let tick = 0; tick <= moved; tick += 1) await fire();
      await fire();

      expect(events.filter((event) => event === "ALERT_TRIGGERED")).toHaveLength(1);
    });

    it("does not fire an alert created when its condition is already true", async () => {
      const { composition: demo, client, events, aaplId, fire } = await setup();
      await demo.marketSimulator.start();
      await client.call(op("createAlert"), {
        body: { assetId: aaplId, type: "PRICE", condition: "ABOVE", threshold: 100 },
      });

      await fire();
      await fire();

      expect(events).toEqual([]);
    });

    it("does not fire the seeded alerts on the first tick: they are about 1% away", async () => {
      const { composition: demo, events, fire } = await setup();
      await demo.marketSimulator.start();

      await fire();

      expect(events).toEqual([]);
    });
  });
});
