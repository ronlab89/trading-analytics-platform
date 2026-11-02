import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";
import type { TransactionFilters } from "../lib/transaction-filters";
import { toTransactionRow } from "../lib/transaction-row";
import { useTransactions, type TransactionsPage } from "./use-transactions";

const NO_ASSET_IDS: readonly string[] = [];

/**
 * The rows of one page of the transactions table: each transaction with the symbol and name of its
 * asset and its total. Like the positions, the rows wait for the assets so none flashes an unknown
 * name, and an asset that fails to load leaves a null symbol and name instead of hiding the row.
 * Only a failed transactions request is an error; `meta` is the server's count for the paging.
 */
export function useTransactionRows(
  portfolioId: string | undefined,
  paging: TransactionsPage,
  filters?: TransactionFilters,
) {
  const transactions = useTransactions(portfolioId, paging, filters);
  const { assets, isPending: assetsPending } = useAssets(
    transactions.data?.transactions.map(({ assetId }) => assetId) ?? NO_ASSET_IDS,
  );

  const rows = useMemo(
    () =>
      transactions.data?.transactions.map((transaction) =>
        toTransactionRow(transaction, assets.get(transaction.assetId)),
      ),
    [transactions.data, assets],
  );

  const isError = transactions.isError && transactions.data === undefined;
  const isPending = !isError && (transactions.data === undefined || assetsPending);

  return {
    rows: isPending ? undefined : rows,
    meta: transactions.data?.meta,
    isPending,
    isError,
    refetch: transactions.refetch,
  };
}
