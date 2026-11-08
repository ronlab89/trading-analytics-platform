import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import { toDecisionRow } from "../lib/decision-row";
import { useDecisions } from "./use-decisions";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of the decisions table: each decision with the symbol and name of its asset. Like the
 * transactions, the rows wait for the assets so none flashes an unknown name, and an asset that
 * fails to load leaves a null symbol and name instead of hiding the row. Only a failed decisions
 * request is an error.
 */
export function useDecisionRows(portfolioId: string | undefined) {
  const decisions = useDecisions(portfolioId);
  const { assets, isPending: assetsPending } = useAssets(
    decisions.data?.map(({ assetId }) => assetId) ?? NO_ASSET_IDS,
  );

  const rows = useMemo(
    () => decisions.data?.map((decision) => toDecisionRow(decision, assets.get(decision.assetId))),
    [decisions.data, assets],
  );

  const isError = decisions.isError;
  const isPending = !isError && (decisions.data === undefined || assetsPending);

  return {
    rows: isPending ? undefined : rows,
    isPending,
    isError,
    refetch: decisions.refetch,
  };
}
