import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { marketOperations, type AssetResponse } from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { assetKeys } from "./use-assets";

const listAssetsOperation = findOperation(marketOperations, "listAssets");

/** The API's own limits: a longer term is a 400, so it is cut instead. */
const MAX_TERM_LENGTH = 100;
const RESULTS = 20;

/**
 * The assets that match a term, for choosing one to trade. Only the active ones are offered, as a
 * transaction on an inactive asset makes no sense. An empty term lists the first ones, which is what
 * the picker shows before the person types. The previous results stay while the next ones load, so
 * the list does not flash empty on every key. The term is sent as it is: waiting for the person
 * to stop typing is the caller's job.
 */
export function useAssetSearch(term: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useTradingClient();
  const search = term.trim().slice(0, MAX_TERM_LENGTH).trim();

  return useQuery({
    queryKey: assetKeys.search(search),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = (await client.call(listAssetsOperation, {
        query: { search: search === "" ? undefined : search, status: "ACTIVE", pageSize: RESULTS },
      })) as { data: AssetResponse[] };
      return data;
    },
  });
}
