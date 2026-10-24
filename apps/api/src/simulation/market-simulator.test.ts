import { capturingLogger, capturingRealtimePublisher } from "@trading/application";
import type { RealtimePublisher } from "@trading/application";
import { Money } from "@trading/domain";
import {
  InMemoryAssetRepository,
  InMemoryHistoricalPriceRepository,
  InMemoryMarketEventRepository,
  InMemoryMarketPriceRepository,
  InMemoryPositionRepository,
} from "@trading/persistence-memory";
import { describe, expect, it, vi } from "vitest";
import { createMarketSimulator } from "./market-simulator.js";
import type { MarketSimulator, MarketSimulatorDependencies } from "./market-simulator.js";
import type { Scheduler } from "./scheduler.js";

const usd = (amount: string) => Money.of(amount, "USD");

/** A clock the test moves by hand. */
function movableClock(start: string) {
  let current = new Date(start);
  return {
    now: () => new Date(current.getTime()),
    set: (iso: string) => {
      current = new Date(iso);
    },
  };
}

/** A scheduler the test fires by hand; `fire` waits for the tick it started. */
function manualScheduler() {
  let task: (() => Promise<void>) | null = null;
  const scheduler: Scheduler = {
    every: (_intervalMs, next) => {
      task = next;
      return {
        stop: () => {
          task = null;
        },
      };
    },
  };
  return {
    scheduler,
    isActive: () => task !== null,
    fire: async () => {
      await task?.();
    },
  };
}

interface SetupOptions {
  now?: string;
  symbols?: string[];
  publisher?: RealtimePublisher;
}

async function setup(options: SetupOptions = {}) {
  const clock = movableClock(options.now ?? "2026-10-23T10:00:00Z");
  const assets = new InMemoryAssetRepository();
  const prices = new InMemoryMarketPriceRepository();
  const events = new InMemoryMarketEventRepository();
  const candles = new InMemoryHistoricalPriceRepository();
  const positions = new InMemoryPositionRepository();
  const captured = capturingRealtimePublisher();
  const logger = capturingLogger();
  const timer = manualScheduler();

  const ids: string[] = [];
  for (const symbol of options.symbols ?? ["AAA", "BBB"]) {
    const asset = await assets.create({
      symbol,
      name: symbol,
      assetType: "STOCK",
      currency: "USD",
      exchange: "MOCK",
    });
    ids.push(asset.id);
    await prices.upsert({
      assetId: asset.id,
      price: usd("100"),
      previousPrice: usd("99"),
      change: usd("1"),
      changePercent: 1.01,
      source: "MOCK",
      timestamp: clock.now(),
    });
  }

  const dependencies: MarketSimulatorDependencies = {
    clock,
    logger,
    publisher: options.publisher ?? captured,
    assetRepository: assets,
    marketPriceRepository: prices,
    marketEventRepository: events,
    historicalPriceRepository: candles,
    positionRepository: positions,
    scheduler: timer.scheduler,
  };
  const create = (overrides: Partial<MarketSimulatorDependencies> = {}): MarketSimulator =>
    createMarketSimulator({ ...dependencies, ...overrides });

  const sequencesOf = async (assetId: string) =>
    (await events.listByAssetId(assetId)).map((event) => event.sequence);
  const logged = (event: string) => logger.entries.filter((entry) => entry.event === event);

  return {
    clock,
    assets,
    prices,
    events,
    candles,
    positions,
    captured,
    logger,
    timer,
    ids,
    dependencies,
    create,
    sequencesOf,
    logged,
  };
}

describe("market simulator ticks", () => {
  it("starts from the persisted price and the highest sequence of each asset", async () => {
    const world = await setup();
    const [first, second] = world.ids;
    for (const sequence of [1, 2, 3, 4, 5]) {
      await world.events.create({ assetId: first ?? "", price: usd("100"), sequence });
    }
    const simulator = world.create();

    await simulator.boot();
    await world.timer.fire();

    expect(await world.sequencesOf(first ?? "")).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await world.sequencesOf(second ?? "")).toEqual([1]);
    const tick = world.captured.published[0];
    expect(tick?.type).toBe("MARKET_PRICE_UPDATED");
    if (tick?.type === "MARKET_PRICE_UPDATED") {
      expect(tick.tick.assetId).toBe(first);
      expect(tick.tick.previousPrice.toString()).toBe("99");
    }
  });

  it("writes the market price, the event, the held positions and the publication of a tick alike", async () => {
    const world = await setup();
    const [assetId] = world.ids;
    const held = await world.positions.upsert({
      portfolioId: "p1",
      assetId: assetId ?? "",
      quantity: 10,
      averageEntryPrice: usd("90"),
      currentPrice: usd("100"),
    });
    const simulator = world.create();
    await simulator.boot();

    for (let index = 0; index < 20; index += 1) {
      await world.timer.fire();
    }

    const price = await world.prices.getByAssetId(assetId ?? "");
    const events = await world.events.listByAssetId(assetId ?? "");
    const last = events[events.length - 1];
    const published = world.captured.published.filter(
      (event) => event.type === "MARKET_PRICE_UPDATED" && event.tick.assetId === assetId,
    );
    expect(events).toHaveLength(20);
    expect(price?.price.toString()).not.toBe("100");
    expect(last?.price.toString()).toBe(price?.price.toString());
    expect((await world.positions.getById(held.id))?.currentPrice.toString()).toBe(
      price?.price.toString(),
    );
    expect(published).toHaveLength(20);
    expect(price?.source).toBe("MOCK");
    expect(price?.previousPrice.toString()).toBe("99");
    expect(price?.change.toString()).toBe(price?.price.subtract(usd("99")).toString());
  });

  it("resumes after a restart without repeating or skipping a sequence", async () => {
    const world = await setup();
    const [assetId] = world.ids;
    const firstRun = world.create();
    await firstRun.boot();
    for (let index = 0; index < 3; index += 1) {
      await world.timer.fire();
    }
    await firstRun.stop();

    const secondRun = world.create();
    await secondRun.boot();
    for (let index = 0; index < 2; index += 1) {
      await world.timer.fire();
    }

    expect(await world.sequencesOf(assetId ?? "")).toEqual([1, 2, 3, 4, 5]);
  });

  it("produces the same prices from the same persisted state", async () => {
    const seriesOf = async () => {
      const world = await setup();
      const simulator = world.create();
      await simulator.boot();
      for (let index = 0; index < 10; index += 1) {
        await world.timer.fire();
      }
      return (await world.events.listByAssetId(world.ids[0] ?? "")).map((event) =>
        event.price.toString(),
      );
    };

    expect(await seriesOf()).toEqual(await seriesOf());
  });

  it("ignores an asset without a market price", async () => {
    const world = await setup();
    await world.assets.create({
      symbol: "NOPRICE",
      name: "No price",
      assetType: "STOCK",
      currency: "USD",
      exchange: "MOCK",
    });
    const simulator = world.create();
    await simulator.boot();
    await world.timer.fire();

    expect(world.captured.published).toHaveLength(2);
  });

  it("keeps ticking when a publication fails, and logs it", async () => {
    const failing: RealtimePublisher = {
      ...capturingRealtimePublisher(),
      marketPriceUpdated: () => Promise.reject(new Error("socket down")),
    };
    const world = await setup({ publisher: failing });
    const simulator = world.create();
    await simulator.boot();
    await world.timer.fire();

    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);
    expect(world.logged("realtime.publish_failed")).toHaveLength(2);
  });
});

describe("market simulator lifecycle", () => {
  it("is RUNNING in NORMAL mode and starts ticking on boot", async () => {
    const world = await setup();
    const simulator = world.create();

    expect(simulator.status()).toEqual({ state: "RUNNING", mode: "NORMAL" });
    expect(world.timer.isActive()).toBe(false);
    await simulator.boot();

    expect(world.timer.isActive()).toBe(true);
    expect(world.logged("simulation.started")).toEqual([
      expect.objectContaining({ level: "info", fields: { mode: "NORMAL", assetCount: 2 } }),
    ]);
  });

  it("stops ticking on pause and resumes the sequences on start", async () => {
    const world = await setup();
    const simulator = world.create();
    await simulator.boot();
    await world.timer.fire();

    expect(simulator.pause()).toEqual({ state: "HALTED", mode: "NORMAL" });
    expect(world.timer.isActive()).toBe(false);
    await world.timer.fire();
    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);

    expect(simulator.start()).toEqual({ state: "RUNNING", mode: "NORMAL" });
    await world.timer.fire();
    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1, 2]);
    expect(world.logged("simulation.paused")).toEqual([
      expect.objectContaining({ level: "info", fields: { mode: "NORMAL" } }),
    ]);
    expect(world.logged("simulation.started")).toHaveLength(2);
  });

  it("answers the same status, with no log, when start or pause change nothing", async () => {
    const world = await setup();
    const simulator = world.create();
    await simulator.boot();

    expect(simulator.start()).toEqual({ state: "RUNNING", mode: "NORMAL" });
    simulator.pause();
    expect(simulator.pause()).toEqual({ state: "HALTED", mode: "NORMAL" });

    expect(world.logged("simulation.started")).toHaveLength(1);
    expect(world.logged("simulation.paused")).toHaveLength(1);
  });

  it("logs a mode change once and answers the new mode", async () => {
    const world = await setup();
    const simulator = world.create();
    await simulator.boot();

    expect(simulator.setMode("VOLATILE")).toEqual({ state: "RUNNING", mode: "VOLATILE" });
    simulator.setMode("VOLATILE");

    expect(world.logged("simulation.mode.changed")).toEqual([
      expect.objectContaining({ level: "info", fields: { from: "NORMAL", to: "VOLATILE" } }),
    ]);
  });

  it("keeps ticking in PAUSED mode but emits nothing", async () => {
    const world = await setup();
    const simulator = world.create();
    await simulator.boot();
    await world.timer.fire();
    simulator.setMode("PAUSED");
    await world.timer.fire();
    await world.timer.fire();

    expect(world.timer.isActive()).toBe(true);
    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);
    expect(world.captured.published).toHaveLength(2);
  });

  it("accepts a mode while HALTED and resumes into it on start", async () => {
    const world = await setup();
    const simulator = world.create();
    await simulator.boot();
    simulator.pause();

    expect(simulator.setMode("BULLISH")).toEqual({ state: "HALTED", mode: "BULLISH" });
    expect(simulator.start()).toEqual({ state: "RUNNING", mode: "BULLISH" });
  });

  it("boots halted, without ticking, when it was paused before the boot", async () => {
    const world = await setup();
    const simulator = world.create();
    simulator.pause();
    await simulator.boot();

    expect(world.timer.isActive()).toBe(false);
    simulator.start();
    expect(world.timer.isActive()).toBe(true);
  });

  it("waits for the tick in flight on stop and never ticks again", async () => {
    const world = await setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const simulator = world.create({
      marketPriceRepository: {
        listByAssetIds: (ids) => world.prices.listByAssetIds(ids),
        upsert: async (input) => {
          await gate;
          return world.prices.upsert(input);
        },
      },
    });
    await simulator.boot();
    const tick = world.timer.fire();
    let stopped = false;
    const stopping = simulator.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(world.timer.isActive()).toBe(false);

    release();
    await Promise.all([tick, stopping]);
    expect(stopped).toBe(true);
    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);

    simulator.pause();
    simulator.start();
    expect(world.timer.isActive()).toBe(false);
  });

  it("skips a tick while the previous one is still running", async () => {
    const world = await setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const simulator = world.create({
      marketPriceRepository: {
        listByAssetIds: (ids) => world.prices.listByAssetIds(ids),
        upsert: async (input) => {
          await gate;
          return world.prices.upsert(input);
        },
      },
    });
    await simulator.boot();
    const first = world.timer.fire();
    const second = world.timer.fire();
    release();
    await Promise.all([first, second]);

    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);
  });
});

describe("market simulator failures", () => {
  it("skips only the failing asset for the tick, logs it and recovers on the next tick", async () => {
    const world = await setup();
    const [failingId, healthyId] = world.ids;
    let failing = true;
    const simulator = world.create({
      marketPriceRepository: {
        listByAssetIds: (ids) => world.prices.listByAssetIds(ids),
        upsert: (input) =>
          failing && input.assetId === failingId
            ? Promise.reject(new Error("db down"))
            : world.prices.upsert(input),
      },
    });
    await simulator.boot();

    await world.timer.fire();
    failing = false;
    await world.timer.fire();

    expect(await world.sequencesOf(healthyId ?? "")).toEqual([1, 2]);
    // The sequence of the failed tick is lost: a gap, never a repeat (decision D6).
    expect(await world.sequencesOf(failingId ?? "")).toEqual([2]);
    expect(world.logged("simulation.tick.failed")).toEqual([
      expect.objectContaining({
        level: "warn",
        fields: { assetId: failingId, sequence: 1, errorName: "Error" },
      }),
    ]);
  });

  it("boots without throwing when the persisted state cannot be read, and logs it", async () => {
    const world = await setup();
    const simulator = world.create({
      assetRepository: { list: () => Promise.reject(new Error("db down")) },
    });

    await expect(simulator.boot()).resolves.toBeUndefined();

    expect(world.logged("simulation.boot.failed")).toEqual([
      expect.objectContaining({ level: "error", fields: { errorName: "Error" } }),
    ]);
    expect(world.timer.isActive()).toBe(false);
    expect(simulator.pause()).toEqual({ state: "HALTED", mode: "NORMAL" });
  });

  it("retries a failed boot on start and begins to tick once it succeeds", async () => {
    const world = await setup();
    let failing = true;
    const simulator = world.create({
      assetRepository: {
        list: (filter, page) =>
          failing ? Promise.reject(new Error("db down")) : world.assets.list(filter, page),
      },
    });
    await simulator.boot();
    expect(world.timer.isActive()).toBe(false);

    failing = false;
    expect(simulator.start()).toEqual({ state: "RUNNING", mode: "NORMAL" });
    await vi.waitFor(() => {
      expect(world.timer.isActive()).toBe(true);
    });
    await world.timer.fire();

    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1]);
    expect(world.logged("simulation.started")).toHaveLength(1);
    expect(world.logged("simulation.boot.failed")).toHaveLength(1);
  });

  it("retries a failed boot only once at a time and keeps failing quietly while the database is down", async () => {
    const world = await setup();
    let calls = 0;
    const simulator = world.create({
      assetRepository: {
        list: () => {
          calls += 1;
          return Promise.reject(new Error("db down"));
        },
      },
    });
    await simulator.boot();
    simulator.start();
    simulator.start();
    await vi.waitFor(() => {
      expect(world.logged("simulation.boot.failed")).toHaveLength(2);
    });

    expect(calls).toBe(2);
    expect(world.timer.isActive()).toBe(false);
    expect(simulator.status()).toEqual({ state: "RUNNING", mode: "NORMAL" });
  });

  it("does not boot on start when no boot was ever attempted", async () => {
    const world = await setup();
    const simulator = world.create();

    simulator.pause();
    simulator.start();
    await world.timer.fire();

    expect(world.timer.isActive()).toBe(false);
    expect(world.logged("simulation.started")).toHaveLength(1);
    expect(world.captured.published).toEqual([]);
  });
});

describe("market simulator daily candles", () => {
  it("closes the candle of the day at the rollover and rolls the previous price to its close", async () => {
    const world = await setup({ now: "2026-10-23T23:59:58Z" });
    const [assetId] = world.ids;
    const simulator = world.create();
    await simulator.boot();
    for (let index = 0; index < 3; index += 1) {
      await world.timer.fire();
    }
    const lastOfDay = await world.prices.getByAssetId(assetId ?? "");

    world.clock.set("2026-10-24T00:00:01Z");
    await world.timer.fire();

    const candle = await world.candles.getLatestByAssetId(assetId ?? "");
    const price = await world.prices.getByAssetId(assetId ?? "");
    expect(candle?.timestamp.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(candle?.volume).toBe(30);
    expect(candle?.close.toString()).toBe(lastOfDay?.price.toString());
    expect(price?.previousPrice.toString()).toBe(candle?.close.toString());
  });

  it("rolls the previous price at the rollover even when the mode is PAUSED", async () => {
    const world = await setup({ now: "2026-10-23T23:59:58Z" });
    const [assetId] = world.ids;
    const simulator = world.create();
    await simulator.boot();
    await world.timer.fire();
    await world.timer.fire();
    simulator.setMode("PAUSED");
    const published = world.captured.published.length;

    world.clock.set("2026-10-24T00:00:05Z");
    await world.timer.fire();

    const candle = await world.candles.getLatestByAssetId(assetId ?? "");
    const price = await world.prices.getByAssetId(assetId ?? "");
    expect(candle?.timestamp.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(price?.price.toString()).toBe(candle?.close.toString());
    expect(price?.previousPrice.toString()).toBe(candle?.close.toString());
    expect(price?.change.toString()).toBe("0");
    expect(price?.changePercent).toBe(0);
    expect(await world.sequencesOf(assetId ?? "")).toEqual([1, 2]);
    expect(world.captured.published).toHaveLength(published);
  });

  it("generates and stores the candles of the days the server was offline at boot", async () => {
    const world = await setup({ now: "2026-10-23T10:00:00Z" });
    for (const assetId of world.ids) {
      await world.candles.create({
        assetId,
        timestamp: new Date("2026-10-19T00:00:00Z"),
        open: usd("98"),
        high: usd("101"),
        low: usd("97"),
        close: usd("100"),
        volume: 1000,
      });
    }
    const simulator = world.create();
    await simulator.boot();

    const stored = await world.candles.listByAssetId(
      world.ids[0] ?? "",
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-31T00:00:00Z"),
    );
    expect(stored.map((candle) => candle.timestamp.toISOString().slice(0, 10))).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    const price = await world.prices.getByAssetId(world.ids[0] ?? "");
    expect(price?.price.toString()).toBe(stored[3]?.close.toString());
    expect(price?.previousPrice.toString()).toBe(stored[3]?.close.toString());
  });

  it("keeps a candle it could not store and stores it once on a later tick", async () => {
    const world = await setup({ now: "2026-10-23T23:59:59Z" });
    let failing = true;
    const simulator = world.create({
      historicalPriceRepository: {
        getLatestByAssetId: (assetId) => world.candles.getLatestByAssetId(assetId),
        create: (input) =>
          failing ? Promise.reject(new Error("db down")) : world.candles.create(input),
      },
    });
    await simulator.boot();
    await world.timer.fire();

    world.clock.set("2026-10-24T00:00:01Z");
    await world.timer.fire();
    expect(await world.candles.getLatestByAssetId(world.ids[0] ?? "")).toBeNull();
    expect(world.logged("simulation.candle.failed")).toHaveLength(1);

    failing = false;
    await world.timer.fire();
    const stored = await world.candles.listByAssetId(
      world.ids[0] ?? "",
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-10-31T00:00:00Z"),
    );
    expect(stored).toHaveLength(1);
  });
});

describe("market simulator retention", () => {
  it("keeps the latest events of each asset and never prunes its last sequence", async () => {
    const world = await setup();
    const simulator = world.create({ eventRetention: 3, pruneEveryTicks: 2 });
    await simulator.boot();
    for (let index = 0; index < 6; index += 1) {
      await world.timer.fire();
    }

    for (const assetId of world.ids) {
      expect(await world.sequencesOf(assetId)).toEqual([4, 5, 6]);
      expect(await world.events.getLastSequence(assetId)).toBe(6);
    }
  });

  it("does not prune before the interval has passed", async () => {
    const world = await setup();
    const simulator = world.create({ eventRetention: 3, pruneEveryTicks: 100 });
    await simulator.boot();
    for (let index = 0; index < 6; index += 1) {
      await world.timer.fire();
    }

    expect(await world.sequencesOf(world.ids[0] ?? "")).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
