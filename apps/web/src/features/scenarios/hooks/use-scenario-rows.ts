import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { ScenarioCalculationResponse } from "@trading/contracts";
import { useMemo } from "react";
import { useTradingClient } from "@/api/trading-client-provider";
import { useAssets } from "@/hooks/use-assets";
import { toScenarioRow } from "../lib/scenario-row";
import { scenarioImpactQuery } from "./use-scenario-impact";
import { useScenarios } from "./use-scenarios";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * Defined once, not inline, because TanStack Query reuses the previous result only while the
 * function is the same one; that keeps both collections the same until a calculation changes.
 */
function indexCalculations(results: UseQueryResult<ScenarioCalculationResponse>[]) {
  return {
    calculations: new Map(
      results.flatMap((result) =>
        result.data ? [[result.data.scenarioId, result.data] as const] : [],
      ),
    ),
    failedPositions: results.flatMap((result, position) => (result.isError ? [position] : [])),
  };
}

/**
 * The rows of the scenarios table: each scenario with the symbol of its main asset and, as each
 * calculation comes back, its figures. The rows wait for the scenarios and the assets, so no symbol
 * flashes, but not for the calculations: there is one per scenario, so a row shows before its
 * figures, and one that fails says so in its own row (`figuresState`) without hiding the others.
 * Only a failed list of scenarios is an error.
 */
export function useScenarioRows(portfolioId: string | undefined) {
  const client = useTradingClient();
  const scenarios = useScenarios(portfolioId);
  const { assets, isPending: assetsPending } = useAssets(
    scenarios.data?.flatMap(({ changes }) => changes.map(({ assetId }) => assetId)) ?? NO_ASSET_IDS,
  );
  const { calculations, failedPositions } = useQueries({
    queries: (scenarios.data ?? []).map(({ id }) =>
      scenarioImpactQuery(client, portfolioId ?? "", id),
    ),
    combine: indexCalculations,
  });

  const rows = useMemo(
    () =>
      scenarios.data?.map((scenario, position) =>
        toScenarioRow(
          scenario,
          assets,
          calculations.get(scenario.id),
          failedPositions.includes(position),
        ),
      ),
    [scenarios.data, assets, calculations, failedPositions],
  );

  const isError = scenarios.isError;
  const isPending = !isError && (scenarios.data === undefined || assetsPending);

  return {
    rows: isPending ? undefined : rows,
    isPending,
    isError,
    refetch: scenarios.refetch,
  };
}
