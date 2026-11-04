import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import { scenarioMainChange } from "../lib/scenario-row";
import type { ScenarioMainChange } from "../types";
import { useScenarios } from "./use-scenarios";

/**
 * The main variable of each of the given scenarios, read from the list the Lab already caches: the
 * comparison does not carry the changes. Unlike the rows of the list it asks for no calculation, so
 * a comparison costs one request, not one per scenario. A scenario the list does not have maps to
 * null, and a symbol that has not arrived yet is null until it does.
 */
export function useScenarioMainChanges(portfolioId: string, scenarioIds: readonly string[]) {
  const scenarios = useScenarios(portfolioId);
  const compared = useMemo(
    () => scenarios.data?.filter((scenario) => scenarioIds.includes(scenario.id)) ?? [],
    [scenarios.data, scenarioIds],
  );
  const { assets } = useAssets(compared.flatMap(({ changes }) => changes.map((c) => c.assetId)));

  return useMemo(
    () =>
      new Map<string, ScenarioMainChange | null>(
        scenarioIds.map((id) => {
          const scenario = compared.find((entry) => entry.id === id);
          return [id, scenario === undefined ? null : scenarioMainChange(scenario, assets)];
        }),
      ),
    [compared, assets, scenarioIds],
  );
}
