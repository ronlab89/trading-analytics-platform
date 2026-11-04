import type { ScenarioResponse } from "@trading/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAssets } from "@/hooks/use-assets";
import { usePositions } from "@/features/portfolios/hooks/use-positions";
import { changesOf, variablesOf, withPercent } from "../lib/scenario-variables";
import { useScenario } from "./use-scenario";
import { useScenarioImpact } from "./use-scenario-impact";
import { useUpdateScenario } from "./use-update-scenario";

type ScenarioChange = ScenarioResponse["changes"][number];

/** How long the sliders rest before their changes are saved, so a drag is one request, not many. */
export const SAVE_PAUSE_MS = 600;

const NO_ASSET_IDS: readonly string[] = [];
const NO_CHANGES: readonly ScenarioChange[] = [];

/**
 * Everything the scenario editor needs. The sliders are the user's: a move shows at once and is
 * saved after a pause with the whole list of changes, because the calculation works on what is
 * stored. The saved scenario is asked for its calculation again, which is what "recalculating" is.
 *
 * Only one save is in flight at a time: a move made meanwhile is saved when it ends, so the server
 * never ends with an older list than the screen. A failed save keeps what the user set and waits
 * for `retry`. Leaving the editor saves a move the pause had not yet sent.
 */
export function useScenarioEditor(
  portfolioId: string,
  scenarioId: string,
  { pauseMs = SAVE_PAUSE_MS }: { pauseMs?: number } = {},
) {
  const scenario = useScenario(portfolioId, scenarioId);
  const positions = usePositions(portfolioId);
  const { assets, isPending: assetsPending } = useAssets(
    positions.data === undefined && scenario.data === undefined
      ? NO_ASSET_IDS
      : [
          ...(positions.data?.map(({ assetId }) => assetId) ?? NO_ASSET_IDS),
          ...(scenario.data?.changes.map(({ assetId }) => assetId) ?? NO_ASSET_IDS),
        ],
  );
  const impact = useScenarioImpact(portfolioId, scenarioId);
  const { mutate } = useUpdateScenario(portfolioId, scenarioId);

  // What the user has set and the server has not confirmed yet; null when the two agree.
  const [pending, setPending] = useState<ScenarioChange[] | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const pendingRef = useRef<ScenarioChange[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const flushRef = useRef<() => void>(() => undefined);

  const changes = pending ?? scenario.data?.changes ?? NO_CHANGES;
  const variables = useMemo(
    () => variablesOf(positions.data ?? [], changes, assets),
    [positions.data, changes, assets],
  );

  const schedule = useCallback((delay: number) => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(() => {
    const toSave = pendingRef.current;
    if (toSave === null || inFlight.current) return;
    inFlight.current = true;
    setSaveFailed(false);
    mutate(
      { changes: toSave },
      {
        onSuccess: () => {
          inFlight.current = false;
          if (pendingRef.current === toSave) {
            pendingRef.current = null;
            setPending(null);
          } else if (timer.current === null) {
            schedule(0);
          }
        },
        onError: () => {
          inFlight.current = false;
          setSaveFailed(true);
        },
      },
    );
  }, [mutate, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      const unsent = pendingRef.current;
      if (unsent !== null && !inFlight.current) mutate({ changes: unsent });
    },
    [mutate],
  );

  const setPercent = (assetId: string, percent: number) => {
    const next = changesOf(withPercent(variables, assetId, percent));
    pendingRef.current = next;
    setPending(next);
    schedule(pauseMs);
  };

  const reset = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pendingRef.current = [];
    setPending([]);
    flush();
  };

  const retry = () => {
    if (saveFailed) flush();
    if (impact.isError) void impact.refetch();
  };

  const saving = pending !== null && !saveFailed;

  return {
    scenario: scenario.data,
    variables,
    isPending: scenario.isPending || positions.isPending || assetsPending,
    isError: scenario.isError || positions.isError,
    setPercent,
    reset,
    retry,
    saving,
    saveFailed,
    recalculating: saving || impact.isFetching,
    failed: saveFailed || impact.isError,
    impact,
  };
}
