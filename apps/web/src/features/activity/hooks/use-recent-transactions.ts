import { useQuery } from "@tanstack/react-query";
import {
  MAX_PAGE_SIZE,
  transactionOperations,
  type PaginationMeta,
  type TransactionResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { transactionKeys } from "@/features/transactions/hooks/use-transactions";

const listTransactionsOperation = findOperation(transactionOperations, "listTransactions");

/** The Figma header says "últimos 30 días": that is the window of the activity. */
export const ACTIVITY_DAYS = 30;

/** A thousand transactions is what the activity reads at most; more would need a server-side feed. */
const MAX_PAGES = 10;

/** The start of the window as a date: the same all day, so the query keeps its key while it is open. */
function windowStart(days: number): string {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days);
  return new Date(start).toISOString().slice(0, 10);
}

/**
 * The transactions of the portfolio in the last 30 days, all of them: the activity groups, filters and
 * pages them on the client, so it needs the whole window and not one server page. The API pages by
 * 100; this reads page after page until the total is reached or ten pages are in.
 */
export function useRecentTransactions(portfolioId: string | undefined) {
  const client = useTradingClient();
  const dateFrom = windowStart(ACTIVITY_DAYS);

  return useQuery({
    queryKey: [...transactionKeys.portfolio(portfolioId ?? ""), "recent", dateFrom] as const,
    enabled: portfolioId !== undefined && portfolioId !== "",
    queryFn: async () => {
      const transactions: TransactionResponse[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { data, meta } = (await client.call(listTransactionsOperation, {
          params: { portfolioId: portfolioId ?? "" },
          query: { page, pageSize: MAX_PAGE_SIZE, dateFrom },
        })) as { data: TransactionResponse[]; meta: PaginationMeta };
        transactions.push(...data);
        if (transactions.length >= meta.total || data.length === 0) break;
      }
      return transactions;
    },
  });
}
