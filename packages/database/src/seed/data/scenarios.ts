import { ScenarioStatus } from "@trading/domain";

export interface ScenarioChangeBlueprint {
  readonly assetSymbol: string;
  readonly percentChange: number;
}

export interface ScenarioBlueprint {
  readonly portfolioName: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ScenarioStatus;
  readonly changes: readonly ScenarioChangeBlueprint[];
}

/**
 * Source: 01-product-spec.md §15 (Scenario Lab). `changes` reference
 * assets by symbol (not id, unknown at file-write time) — resolved to
 * real ids by the seed step at run time.
 */
export const SEED_SCENARIOS: readonly ScenarioBlueprint[] = [
  {
    portfolioName: "Main Portfolio",
    name: "Increase tech exposure",
    description: "Evaluate a heavier allocation toward AAPL and MSFT.",
    status: ScenarioStatus.SAVED,
    changes: [
      { assetSymbol: "AAPL", percentChange: 15 },
      { assetSymbol: "MSFT", percentChange: -10 },
    ],
  },
];
