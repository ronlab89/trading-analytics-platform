import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  transactionOperations,
  type PaginationMeta,
  type TransactionResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const listTransactionsOperation = findOperation(transactionOperations, "listTransactions");

export interface TransactionsPage {
  page: number;
  pageSize: number;
}

/** Query keys of the transaction data, so recording one can invalidate every page of its portfolio. */
export const transactionKeys = {
  all: ["transactions"] as const,
  portfolio: (portfolioId: string) => [...transactionKeys.all, portfolioId] as const,
  list: (portfolioId: string, { page, pageSize }: TransactionsPage) =>
    [...transactionKeys.portfolio(portfolioId), "list", page, pageSize] as const,
};

/**
 * One page of the transactions of a portfolio, paged by the server. The previous page stays on
 * screen while the next one loads, so paging does not flash the table empty. It stays idle while
 * the route has no portfolio.
 */
export function useTransactions(
  portfolioId: string | undefined,
  { page, pageSize }: TransactionsPage,
) {
  const client = useTradingClient();

  return useQuery({
    queryKey: transactionKeys.list(portfolioId ?? "", { page, pageSize }),
    enabled: portfolioId !== undefined && portfolioId !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, meta } = (await client.call(listTransactionsOperation, {
        params: { portfolioId: portfolioId ?? "" },
        query: { page, pageSize },
      })) as { data: TransactionResponse[]; meta: PaginationMeta };
      return { transactions: data, meta };
    },
  });
}
