import type { MoneyDto, ScenarioComparisonResponse, ScenarioResponse } from "@trading/contracts";
import type { ScenarioMainChange } from "../types";

/** One column of the comparison: the portfolio as it is, or one scenario applied to it. */
export interface ComparisonColumn {
  /** `"base"` for the portfolio as it is, the scenario id otherwise. */
  id: string;
  /** "A", "B"… in the order the scenarios were asked for; null for the base. */
  letter: string | null;
  /** The scenario's name; null for the base, which the screen names itself. */
  name: string | null;
  status: ScenarioResponse["status"] | null;
  value: MoneyDto;
  returnPercent: number;
  profit: MoneyDto;
  /** How far the value moves against the base; null for the base and when the base is worth nothing. */
  valueChangePercent: number | null;
  /** The change that moves a price the most, as the list tells it; null when it is not known. */
  mainChange: ScenarioMainChange | null;
  /** Assets of the scenario the API could not match to a position. */
  unmatchedAssetIds: readonly string[];
}

/** The weight of one asset in the portfolio, in the base and in each scenario. */
export interface AssetWeightRow {
  assetId: string;
  symbol: string | null;
  name: string | null;
  base: number;
  /** One per scenario, in the order of the columns after the base. */
  scenarios: { weight: number; shift: number }[];
}

export interface ComparisonView {
  /** The base first, then the scenarios. */
  columns: ComparisonColumn[];
  assets: AssetWeightRow[];
}

const LETTERS = "ABCDE";

/**
 * What the comparison screen draws, from the answer of the API: the columns (base and scenarios)
 * and the weight of each asset in all of them. An asset only some of the scenarios hold is a row
 * all the same, with no weight where it is missing, so the columns always line up. The main
 * variable is not in the answer, so it comes from the list of scenarios.
 */
export function compareView(
  comparison: ScenarioComparisonResponse,
  mainChanges: ReadonlyMap<string, ScenarioMainChange | null>,
): ComparisonView {
  const { baseline, scenarios } = comparison;

  const columns: ComparisonColumn[] = [
    {
      id: "base",
      letter: null,
      name: null,
      status: null,
      value: baseline.metrics.totalValue,
      returnPercent: baseline.metrics.unrealizedPnLPercent,
      profit: baseline.metrics.unrealizedPnL,
      valueChangePercent: null,
      mainChange: null,
      unmatchedAssetIds: [],
    },
    ...scenarios.map((scenario, index) => ({
      id: scenario.scenarioId,
      letter: LETTERS[index] ?? null,
      name: scenario.name,
      status: scenario.status,
      value: scenario.metrics.totalValue,
      returnPercent: scenario.metrics.unrealizedPnLPercent,
      profit: scenario.metrics.unrealizedPnL,
      valueChangePercent: scenario.difference.totalValuePercent,
      mainChange: mainChanges.get(scenario.scenarioId) ?? null,
      unmatchedAssetIds: scenario.unmatchedAssetIds,
    })),
  ];

  const rows = new Map<string, AssetWeightRow>();
  for (const asset of baseline.assets) {
    rows.set(asset.assetId, {
      assetId: asset.assetId,
      symbol: asset.symbol,
      name: asset.name,
      base: asset.allocationPercent,
      scenarios: [],
    });
  }
  for (const scenario of scenarios) {
    for (const asset of scenario.assets) {
      if (!rows.has(asset.assetId)) {
        rows.set(asset.assetId, {
          assetId: asset.assetId,
          symbol: asset.symbol,
          name: asset.name,
          base: 0,
          scenarios: [],
        });
      }
    }
  }
  for (const row of rows.values()) {
    row.scenarios = scenarios.map((scenario) => {
      const held = scenario.assets.find(({ assetId }) => assetId === row.assetId);
      return held === undefined
        ? { weight: 0, shift: -row.base }
        : { weight: held.allocationPercent, shift: held.allocationShift };
    });
  }

  return { columns, assets: [...rows.values()] };
}
