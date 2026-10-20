import { describe, expect, it } from "vitest";
import { buildPortfolioSeries, type PortfolioSeriesDependencies } from "./portfolio-series.js";
import { capturingLogger } from "./logger.js";

const portfolio = { id: "portfolio-1", baseCurrency: "USD" } as const;
const query = { kind: "preset", period: "ALL" } as const;
const start = new Date("2026-04-01T12:00:00Z");

/** A clock that only moves when the repository "works" for `workMs`, so the duration is exact. */
function slowDependencies(workMs: number, overrides: Partial<PortfolioSeriesDependencies> = {}) {
  let current = start.getTime();
  const dependencies: PortfolioSeriesDependencies = {
    transactionRepository: {
      listCompletedByPortfolioId: () => {
        current += workMs;
        return Promise.resolve([]);
      },
    },
    historicalPriceRepository: { listByAssetIds: () => Promise.resolve([]) },
    clock: { now: () => new Date(current) },
    ...overrides,
  };
  return dependencies;
}

describe("buildPortfolioSeries timing (ADR-009 point 8)", () => {
  it("logs analytics.series.built at debug with the duration read from the clock", async () => {
    const logger = capturingLogger();

    await buildPortfolioSeries(
      slowDependencies(120, { logger, slowThresholdMs: 500 }),
      portfolio,
      query,
    );

    expect(logger.entries).toEqual([
      {
        level: "debug",
        event: "analytics.series.built",
        fields: { portfolioId: "portfolio-1", durationMs: 120, days: 0 },
      },
    ]);
  });

  it("raises the entry to warn only above the threshold", async () => {
    const above = capturingLogger();
    const at = capturingLogger();

    await buildPortfolioSeries(
      slowDependencies(501, { logger: above, slowThresholdMs: 500 }),
      portfolio,
      query,
    );
    await buildPortfolioSeries(
      slowDependencies(500, { logger: at, slowThresholdMs: 500 }),
      portfolio,
      query,
    );

    expect(above.entries[0]?.level).toBe("warn");
    expect(at.entries[0]?.level).toBe("debug");
  });

  it("stays at debug when no threshold is given", async () => {
    const logger = capturingLogger();

    await buildPortfolioSeries(slowDependencies(60_000, { logger }), portfolio, query);

    expect(logger.entries[0]?.level).toBe("debug");
  });

  it("returns the same series with and without a logger", async () => {
    const withLogger = await buildPortfolioSeries(
      slowDependencies(10, { logger: capturingLogger() }),
      portfolio,
      query,
    );
    const without = await buildPortfolioSeries(slowDependencies(10), portfolio, query);

    expect(withLogger).toEqual(without);
  });

  it("logs nothing when the reconstruction fails", async () => {
    const logger = capturingLogger();
    const failing = slowDependencies(10, {
      logger,
      transactionRepository: { listCompletedByPortfolioId: () => Promise.reject(new Error("db")) },
    });

    await expect(buildPortfolioSeries(failing, portfolio, query)).rejects.toThrow("db");

    expect(logger.entries).toEqual([]);
  });
});
