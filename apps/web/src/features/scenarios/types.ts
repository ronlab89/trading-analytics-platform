import type { MoneyDto, ScenarioResponse } from "@trading/contracts";

/** The price change of one asset that a scenario applies. */
export interface ScenarioMainChange {
  assetId: string;
  /** Null when the asset is not known: the change is kept instead of hiding it. */
  symbol: string | null;
  percentChange: number;
}

/** What a scenario does to the value of the portfolio, from its calculation. */
export interface ScenarioFigures {
  base: MoneyDto;
  withScenario: MoneyDto;
  /** Null when the base is worth nothing, so there is nothing to measure against. */
  impactPercent: number | null;
}

/**
 * What a scenario looks like to the table that lists it: the scenario with its main variable and,
 * once its calculation has come back, the figures. The calculation is one request per scenario, so
 * a row can be shown before its figures.
 */
export interface ScenarioRow {
  id: string;
  name: string;
  status: ScenarioResponse["status"];
  updatedAt: string;
  /** Null when the scenario changes nothing. */
  mainChange: ScenarioMainChange | null;
  /** How many changes the scenario holds besides the main one. */
  otherChanges: number;
  /** Null until the calculation has come back, and for good if it failed. */
  figures: ScenarioFigures | null;
  /** Whether the figures are in, still on their way, or could not be calculated. */
  figuresState: "ready" | "loading" | "failed";
}
