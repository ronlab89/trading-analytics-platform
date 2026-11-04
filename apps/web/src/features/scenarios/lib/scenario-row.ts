import type { ScenarioCalculationResponse, ScenarioResponse } from "@trading/contracts";
import type { ScenarioFigures, ScenarioMainChange, ScenarioRow } from "../types";

/**
 * The scenario as the list shows it. The main variable is the change that moves a price the most,
 * the first one when two move the same; the others are only counted. Without a calculation the row
 * has no figures yet.
 */
export function toScenarioRow(
  scenario: ScenarioResponse,
  assets: ReadonlyMap<string, { symbol: string }>,
  calculation: ScenarioCalculationResponse | undefined,
): ScenarioRow {
  const main = mainChangeOf(scenario.changes);

  return {
    id: scenario.id,
    name: scenario.name,
    status: scenario.status,
    updatedAt: scenario.updatedAt,
    mainChange:
      main === null
        ? null
        : {
            assetId: main.assetId,
            symbol: assets.get(main.assetId)?.symbol ?? null,
            percentChange: main.percentChange,
          },
    otherChanges: main === null ? 0 : scenario.changes.length - 1,
    figures: calculation === undefined ? null : figuresOf(calculation),
  };
}

function mainChangeOf(
  changes: ScenarioResponse["changes"],
): Pick<ScenarioMainChange, "assetId" | "percentChange"> | null {
  let main: ScenarioResponse["changes"][number] | undefined;
  for (const change of changes) {
    if (main === undefined || Math.abs(change.percentChange) > Math.abs(main.percentChange)) {
      main = change;
    }
  }
  return main ?? null;
}

function figuresOf(calculation: ScenarioCalculationResponse): ScenarioFigures {
  const base = calculation.baseline.totalValue;
  const withScenario = calculation.result.totalValue;
  const baseAmount = Number(base.amount);

  return {
    base,
    withScenario,
    impactPercent:
      baseAmount === 0 ? null : ((Number(withScenario.amount) - baseAmount) / baseAmount) * 100,
  };
}
