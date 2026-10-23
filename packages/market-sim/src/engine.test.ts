import { Money } from "@trading/domain";
import { describe, expect, it } from "vitest";
import { createMarketEngine, InvalidSimulationInputError } from "./engine";
import type { AssetSeed, PriceTick } from "./engine";
import { MarketMode } from "./mode";

const clock = { now: () => new Date("2026-10-23T14:30:00.000Z") };

function asset(assetId: string, price = "100.00", previousClose = "100.00"): AssetSeed {
  return {
    assetId,
    price: Money.of(price, "USD"),
    previousClose: Money.of(previousClose, "USD"),
  };
}

function run(options: {
  seed: string | number;
  assets: AssetSeed[];
  mode?: MarketMode;
  ticks: number;
}): PriceTick[][] {
  const engine = createMarketEngine({
    clock,
    seed: options.seed,
    assets: options.assets,
    ...(options.mode ? { mode: options.mode } : {}),
  });
  return Array.from({ length: options.ticks }, () => engine.tick());
}

function snapshot(ticks: PriceTick[][]): string[][] {
  return ticks.map((batch) => batch.map((tick) => `${tick.assetId}:${tick.price.toString()}`));
}

function first(batch: PriceTick[]): PriceTick {
  const tick = batch[0];
  if (!tick) {
    throw new Error("Expected the engine to return a tick.");
  }
  return tick;
}

function finalPrice(ticks: PriceTick[][], assetId: string): number {
  const last = ticks[ticks.length - 1]?.find((tick) => tick.assetId === assetId);
  return last ? last.price.toNumber() : Number.NaN;
}

describe("createMarketEngine", () => {
  describe("determinism", () => {
    it("produces the same ticks for the same seed, assets, mode and clock", () => {
      const assets = [asset("a"), asset("b", "250.00", "248.00")];
      const first = run({ seed: "demo", assets, ticks: 60 });
      const second = run({ seed: "demo", assets, ticks: 60 });
      expect(snapshot(first)).toEqual(snapshot(second));
      expect(first).toEqual(second);
    });

    it("produces a different series for a different seed", () => {
      const assets = [asset("a")];
      expect(snapshot(run({ seed: "one", assets, ticks: 60 }))).not.toEqual(
        snapshot(run({ seed: "two", assets, ticks: 60 })),
      );
    });

    it("keeps an asset's series when another asset runs beside it", () => {
      const alone = run({ seed: "demo", assets: [asset("a")], ticks: 40 });
      const together = run({ seed: "demo", assets: [asset("b"), asset("a")], ticks: 40 });
      const togetherA = together.map((batch) => batch.filter((tick) => tick.assetId === "a"));
      expect(snapshot(togetherA)).toEqual(snapshot(alone));
    });
  });

  describe("tick output", () => {
    it("returns one tick per asset in the order of the assets", () => {
      const [batch] = run({ seed: 1, assets: [asset("b"), asset("a")], ticks: 1 });
      expect(batch?.map((tick) => tick.assetId)).toEqual(["b", "a"]);
    });

    it("reports tickChange as the delta from the previous tick, starting at the initial price", () => {
      const ticks = run({ seed: 7, assets: [asset("a", "100.00", "90.00")], ticks: 25 });
      let previous = Money.of("100.00", "USD");
      for (const batch of ticks) {
        const tick = first(batch);
        expect(tick.tickChange.toString()).toBe(tick.price.subtract(previous).toString());
        previous = tick.price;
      }
    });

    it("measures change, changePercent and previousPrice against the last daily close, not the previous tick", () => {
      const ticks = run({ seed: 7, assets: [asset("a", "100.00", "80.00")], ticks: 25 });
      for (const batch of ticks) {
        const tick = first(batch);
        expect(tick.previousPrice.toString()).toBe("80");
        expect(tick.change.toString()).toBe(tick.price.subtract(Money.of("80", "USD")).toString());
        expect(tick.changePercent).toBeCloseTo(((tick.price.toNumber() - 80) / 80) * 100, 10);
      }
    });

    it("counts the sequence per asset from the given start and stamps the clock time", () => {
      const engine = createMarketEngine({
        clock,
        seed: 3,
        assets: [{ ...asset("a"), sequence: 1200 }, asset("b")],
      });
      engine.tick();
      const [a, b] = engine.tick();
      expect(a?.sequence).toBe(1202);
      expect(b?.sequence).toBe(2);
      expect(a?.timestamp.toISOString()).toBe("2026-10-23T14:30:00.000Z");
    });

    it("keeps the currency of the asset", () => {
      const engine = createMarketEngine({
        clock,
        seed: 3,
        assets: [
          { assetId: "a", price: Money.of("10", "EUR"), previousClose: Money.of("10", "EUR") },
        ],
      });
      const [tick] = engine.tick();
      expect(tick?.price.currency).toBe("EUR");
      expect(tick?.tickChange.currency).toBe("EUR");
    });
  });

  describe("modes", () => {
    it("defaults to NORMAL and reports a mode change", () => {
      const engine = createMarketEngine({ clock, seed: 1, assets: [asset("a")] });
      expect(engine.mode()).toBe(MarketMode.NORMAL);
      engine.setMode(MarketMode.BEARISH);
      expect(engine.mode()).toBe(MarketMode.BEARISH);
    });

    it("returns no ticks and uses no sequence while PAUSED, and resumes where it stopped", () => {
      const engine = createMarketEngine({ clock, seed: 1, assets: [asset("a")] });
      const before = first(engine.tick());
      engine.setMode(MarketMode.PAUSED);
      expect(engine.tick()).toEqual([]);
      expect(engine.tick()).toEqual([]);
      engine.setMode(MarketMode.NORMAL);
      const after = first(engine.tick());
      expect(after.sequence).toBe(before.sequence + 1);
      expect(after.tickChange.toString()).toBe(after.price.subtract(before.price).toString());
    });

    it("drifts up in BULLISH and down in BEARISH, on average across seeds", () => {
      const seeds = Array.from({ length: 12 }, (_, index) => `seed-${String(index)}`);
      const meanReturn = (mode: MarketMode): number => {
        const total = seeds.reduce(
          (sum, seed) =>
            sum + (finalPrice(run({ seed, assets: [asset("a")], mode, ticks: 1500 }), "a") - 100),
          0,
        );
        return total / seeds.length;
      };
      expect(meanReturn(MarketMode.BULLISH)).toBeGreaterThan(3);
      expect(meanReturn(MarketMode.BEARISH)).toBeLessThan(-3);
      expect(Math.abs(meanReturn(MarketMode.NORMAL))).toBeLessThan(3);
    });

    it("moves more in VOLATILE than in NORMAL", () => {
      const spread = (mode: MarketMode): number => {
        const ticks = run({ seed: "spread", assets: [asset("a")], mode, ticks: 1000 });
        const moves = ticks.map((batch) => Math.abs(first(batch).tickChange.toNumber()));
        return moves.reduce((sum, move) => sum + move, 0) / moves.length;
      };
      expect(spread(MarketMode.VOLATILE)).toBeGreaterThan(spread(MarketMode.NORMAL) * 2);
    });

    it("never produces a price at or below zero, even from the minimum price in VOLATILE mode", () => {
      const ticks = run({
        seed: "floor",
        assets: [asset("a", "0.01", "0.01")],
        mode: MarketMode.VOLATILE,
        ticks: 5000,
      });
      for (const batch of ticks) {
        expect(first(batch).price.isPositive()).toBe(true);
      }
    });
  });

  describe("input validation", () => {
    it("rejects a duplicate asset", () => {
      expect(() =>
        createMarketEngine({ clock, seed: 1, assets: [asset("a"), asset("a")] }),
      ).toThrow(InvalidSimulationInputError);
    });

    it("rejects a non-positive price or previous close", () => {
      expect(() => createMarketEngine({ clock, seed: 1, assets: [asset("a", "0", "10")] })).toThrow(
        InvalidSimulationInputError,
      );
      expect(() => createMarketEngine({ clock, seed: 1, assets: [asset("a", "10", "0")] })).toThrow(
        InvalidSimulationInputError,
      );
    });

    it("rejects an asset that mixes currencies", () => {
      const mixed: AssetSeed = {
        assetId: "a",
        price: Money.of("10", "USD"),
        previousClose: Money.of("10", "EUR"),
      };
      expect(() => createMarketEngine({ clock, seed: 1, assets: [mixed] })).toThrow(
        InvalidSimulationInputError,
      );
    });
  });
});
