import type { MoneyDto, PositionResponse, ScenarioResponse } from "@trading/contracts";

type ScenarioChange = ScenarioResponse["changes"][number];

/** The range of a price slider, in percent. The API only sets a floor (-100 %), the design a span. */
export const VARIABLE_RANGE = { min: -10, max: 10, step: 1 } as const;

/**
 * One slider of the editor: the price of an asset and how far the scenario moves it. A percent of
 * zero is "Base": the scenario does not touch that asset.
 */
export interface ScenarioVariable {
  assetId: string;
  /** Null when the asset is not known: the variable is kept instead of hiding its change. */
  symbol: string | null;
  /** The price today. Null for an asset the portfolio no longer holds. */
  price: MoneyDto | null;
  percent: number;
}

/**
 * The sliders of a scenario: one per asset the portfolio holds, in the order of its positions, with
 * the change the scenario already has for it. A change for an asset that is not held any more is
 * kept as a last slider with no price, because the changes are saved as a whole list and leaving it
 * out would drop it the first time the user moves anything.
 */
export function variablesOf(
  positions: readonly PositionResponse[],
  changes: readonly ScenarioChange[],
  assets: ReadonlyMap<string, { symbol: string }>,
): ScenarioVariable[] {
  const percentOf = new Map(changes.map((change) => [change.assetId, change.percentChange]));
  const held = new Set(positions.map((position) => position.assetId));

  return [
    ...positions.map<ScenarioVariable>((position) => ({
      assetId: position.assetId,
      symbol: assets.get(position.assetId)?.symbol ?? null,
      price: position.currentPrice,
      percent: percentOf.get(position.assetId) ?? 0,
    })),
    ...changes
      .filter((change) => !held.has(change.assetId))
      .map<ScenarioVariable>((change) => ({
        assetId: change.assetId,
        symbol: assets.get(change.assetId)?.symbol ?? null,
        price: null,
        percent: change.percentChange,
      })),
  ];
}

/** The changes to save: only the variables that move, since "Base" is the absence of a change. */
export function changesOf(variables: readonly ScenarioVariable[]): ScenarioChange[] {
  return variables
    .filter((variable) => variable.percent !== 0)
    .map(({ assetId, percent }) => ({ assetId, percentChange: percent }));
}

/** The same sliders with one moved; the list it was given is left as it was. */
export function withPercent(
  variables: readonly ScenarioVariable[],
  assetId: string,
  percent: number,
): ScenarioVariable[] {
  return variables.map((variable) =>
    variable.assetId === assetId ? { ...variable, percent } : variable,
  );
}

/** Whether two lists of changes say the same, whatever their order. */
export function sameChanges(
  first: readonly ScenarioChange[],
  second: readonly ScenarioChange[],
): boolean {
  if (first.length !== second.length) return false;
  const percentOf = new Map(second.map((change) => [change.assetId, change.percentChange]));
  return first.every((change) => percentOf.get(change.assetId) === change.percentChange);
}
