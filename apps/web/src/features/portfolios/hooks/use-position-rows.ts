import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import type { PositionRow } from "../types";
import { usePositions } from "./use-positions";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of the positions table: each position with the symbol and name of its asset. The rows
 * wait for the assets, so no row flashes an unknown name before its own arrives; an asset that
 * fails to load leaves its row with a null symbol and name instead of hiding the position. Only a
 * failed positions request is an error here, and `rows` stays the same array until a query changes.
 */
export function usePositionRows(portfolioId: string | undefined) {
  const positions = usePositions(portfolioId);
  const { assets, isPending: assetsPending } = useAssets(
    positions.data?.map(({ assetId }) => assetId) ?? NO_ASSET_IDS,
  );

  const rows = useMemo(
    () =>
      positions.data?.map<PositionRow>((position) => {
        const asset = assets.get(position.assetId);
        return {
          id: position.id,
          symbol: asset?.symbol ?? null,
          name: asset?.name ?? null,
          quantity: position.quantity,
          averageEntryPrice: position.averageEntryPrice,
          currentPrice: position.currentPrice,
        };
      }),
    [positions.data, assets],
  );

  const isError = positions.isError && positions.data === undefined;
  const isPending = !isError && (positions.data === undefined || assetsPending);

  return {
    rows: isPending ? undefined : rows,
    isPending,
    isError,
    refetch: positions.refetch,
  };
}
