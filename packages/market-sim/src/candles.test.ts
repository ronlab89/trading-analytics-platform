import { Money, validateNewHistoricalPrice } from "@trading/domain";
import type { HistoricalPrice } from "@trading/domain";
import { describe, expect, it } from "vitest";
import { utcDay, utcDayStart } from "./candles";
import { createMarketEngine } from "./engine";
import type { AssetSeed, MarketEngine, PriceTick } from "./engine";
import { MarketMode } from "./mode";

/** A clock the test moves by hand. */
function movableClock(start: string): { now: () => Date; set: (iso: string) => void } {
  let current = new Date(start);
  return {
    now: () => new Date(current.getTime()),
    set: (iso) => {
      current = new Date(iso);
    },
  };
}

function seed(assetId: string, lastCandleAt?: string, price = "100.00"): AssetSeed {
  return {
    assetId,
    price: Money.of(price, "USD"),
    previousClose: Money.of(price, "USD"),
    ...(lastCandleAt ? { lastCandleAt: new Date(lastCandleAt) } : {}),
  };
}

function first(batch: PriceTick[]): PriceTick {
  const tick = batch[0];
  if (!tick) {
    throw new Error("Expected the engine to return a tick.");
  }
  return tick;
}

function days(candles: HistoricalPrice[]): string[] {
  return candles.map((candle) => candle.timestamp.toISOString().slice(0, 10));
}

function engineWith(
  clock: { now: () => Date },
  assets: AssetSeed[],
  options: { seed?: string; mode?: MarketMode } = {},
): MarketEngine {
  return createMarketEngine({
    clock,
    seed: options.seed ?? "candles",
    assets,
    ...(options.mode ? { mode: options.mode } : {}),
  });
}

describe("utc days", () => {
  it("counts whole UTC days and maps a day back to its midnight", () => {
    expect(utcDay(new Date("1970-01-02T00:00:00.000Z"))).toBe(1);
    expect(utcDay(new Date("2026-10-23T23:59:59.999Z"))).toBe(
      utcDay(new Date("2026-10-23T00:00:00Z")),
    );
    expect(utcDayStart(utcDay(new Date("2026-10-23T14:30:00Z"))).toISOString()).toBe(
      "2026-10-23T00:00:00.000Z",
    );
  });
});

describe("day rollover", () => {
  it("returns no candle while the day goes on", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    const engine = engineWith(clock, [seed("a")]);
    engine.tick();
    engine.tick();
    expect(engine.takeClosedCandles()).toEqual([]);
  });

  it("closes the candle of each asset when the clock enters a new UTC day", () => {
    const clock = movableClock("2026-10-23T23:59:58Z");
    const engine = engineWith(clock, [
      seed("a", undefined, "100.00"),
      seed("b", undefined, "50.00"),
    ]);
    const live: PriceTick[] = [];
    for (let index = 0; index < 5; index += 1) {
      live.push(...engine.tick());
    }
    clock.set("2026-10-24T00:00:00Z");
    engine.tick();

    const candles = engine.takeClosedCandles();
    expect(candles.map((candle) => candle.assetId)).toEqual(["a", "b"]);
    expect(days(candles)).toEqual(["2026-10-23", "2026-10-23"]);

    const candleA = candles[0];
    if (!candleA) {
      throw new Error("Expected a candle for asset a.");
    }
    const ticksA = live.filter((tick) => tick.assetId === "a").map((tick) => tick.price);
    const prices = [Money.of("100.00", "USD"), ...ticksA];
    expect(candleA.timestamp.toISOString()).toBe("2026-10-23T00:00:00.000Z");
    expect(candleA.open.toString()).toBe("100");
    expect(candleA.close.toString()).toBe(ticksA[ticksA.length - 1]?.toString());
    expect(candleA.high.toString()).toBe(
      prices.reduce((high, price) => (price.greaterThan(high) ? price : high)).toString(),
    );
    expect(candleA.low.toString()).toBe(
      prices.reduce((low, price) => (price.lessThan(low) ? price : low)).toString(),
    );
    expect(candleA.volume).toBe(50);
  });

  it("returns each candle once", () => {
    const clock = movableClock("2026-10-23T23:59:59Z");
    const engine = engineWith(clock, [seed("a")]);
    engine.tick();
    clock.set("2026-10-24T00:00:01Z");
    engine.tick();
    expect(engine.takeClosedCandles()).toHaveLength(1);
    expect(engine.takeClosedCandles()).toEqual([]);
  });

  it("rolls the previous close to the closed candle and measures the new day against it", () => {
    const clock = movableClock("2026-10-23T23:59:59Z");
    const engine = engineWith(clock, [seed("a", undefined, "100.00")]);
    const lastOfDay = first(engine.tick());
    clock.set("2026-10-24T00:00:00Z");
    const firstOfDay = first(engine.tick());

    const [candle] = engine.takeClosedCandles();
    expect(candle?.close.toString()).toBe(lastOfDay.price.toString());
    expect(firstOfDay.previousPrice.toString()).toBe(lastOfDay.price.toString());
    expect(firstOfDay.change.toString()).toBe(firstOfDay.tickChange.toString());
    expect(firstOfDay.tickChange.toString()).toBe(
      firstOfDay.price.subtract(lastOfDay.price).toString(),
    );
  });

  it("closes the candle even while PAUSED, and ticks again afterwards", () => {
    const clock = movableClock("2026-10-23T23:59:59Z");
    const engine = engineWith(clock, [seed("a")]);
    engine.tick();
    engine.setMode(MarketMode.PAUSED);
    clock.set("2026-10-24T00:00:05Z");
    expect(engine.tick()).toEqual([]);
    expect(engine.takeClosedCandles()).toHaveLength(1);
    engine.setMode(MarketMode.NORMAL);
    expect(engine.tick()).toHaveLength(1);
    expect(engine.takeClosedCandles()).toEqual([]);
  });

  it("fills the days a fast clock skips, with no hole in the series", () => {
    const clock = movableClock("2026-10-20T12:00:00Z");
    const engine = engineWith(clock, [seed("a")]);
    engine.tick();
    clock.set("2026-10-24T00:00:00Z");
    engine.tick();

    const candles = engine.takeClosedCandles();
    expect(days(candles)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
    for (let index = 1; index < candles.length; index += 1) {
      expect(candles[index]?.open.toString()).toBe(candles[index - 1]?.close.toString());
    }
  });
});

describe("offline days at start", () => {
  it("generates a candle for each missing day up to yesterday, chained from the current price", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    const engine = engineWith(clock, [seed("a", "2026-10-18T00:00:00Z", "100.00")]);

    const candles = engine.takeClosedCandles();
    expect(days(candles)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(candles[0]?.open.toString()).toBe("100");
    for (let index = 1; index < candles.length; index += 1) {
      expect(candles[index]?.open.toString()).toBe(candles[index - 1]?.close.toString());
    }

    const live = first(engine.tick());
    expect(live.previousPrice.toString()).toBe(candles[3]?.close.toString());
  });

  it("generates valid OHLC candles", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    const engine = engineWith(clock, [seed("a", "2026-08-01T00:00:00Z")]);
    const candles = engine.takeClosedCandles();
    expect(candles.length).toBeGreaterThan(80);
    for (const candle of candles) {
      expect(() => {
        validateNewHistoricalPrice(candle);
      }).not.toThrow();
    }
  });

  it("generates the same candles for the same seed and a different series for another seed", () => {
    const candlesFor = (seedText: string): string[] => {
      const clock = movableClock("2026-10-23T10:00:00Z");
      const engine = engineWith(clock, [seed("a", "2026-10-10T00:00:00Z")], { seed: seedText });
      return engine
        .takeClosedCandles()
        .map(
          (candle) =>
            `${candle.timestamp.toISOString()}:${candle.close.toString()}:${String(candle.volume)}`,
        );
    };
    expect(candlesFor("same")).toEqual(candlesFor("same"));
    expect(candlesFor("same")).not.toEqual(candlesFor("other"));
  });

  it("generates the candles of each asset on its own gap", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    const engine = engineWith(clock, [
      seed("a", "2026-10-20T00:00:00Z"),
      seed("b", "2026-10-21T00:00:00Z"),
    ]);
    const candles = engine.takeClosedCandles();
    expect(candles.filter((candle) => candle.assetId === "a")).toHaveLength(2);
    expect(candles.filter((candle) => candle.assetId === "b")).toHaveLength(1);
    expect(days(candles)).toEqual([...days(candles)].sort());
  });

  it("generates nothing when the last candle is yesterday, today or later, or unknown", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    for (const last of ["2026-10-22T00:00:00Z", "2026-10-23T00:00:00Z", "2026-11-01T00:00:00Z"]) {
      expect(engineWith(clock, [seed("a", last)]).takeClosedCandles()).toEqual([]);
    }
    expect(engineWith(clock, [seed("a")]).takeClosedCandles()).toEqual([]);
  });

  it("keeps the generated candles positive from a very low price", () => {
    const clock = movableClock("2026-10-23T10:00:00Z");
    const engine = engineWith(clock, [seed("a", "2026-06-01T00:00:00Z", "0.01")]);
    for (const candle of engine.takeClosedCandles()) {
      expect(candle.low.isPositive()).toBe(true);
    }
  });
});
