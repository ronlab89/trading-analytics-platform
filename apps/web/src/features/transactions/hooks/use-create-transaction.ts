import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transactionOperations,
  type CreateTransactionRequestBody,
  type CreateTransactionResponse,
} from "@trading/contracts";
import { useRef } from "react";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";
import { analyticsKeys } from "@/features/analytics/hooks/analytics-keys";
import { overviewKeys } from "@/features/dashboard/hooks/use-overview";
import { performanceKeys } from "@/features/dashboard/hooks/use-performance";
import { portfolioKeys } from "@/hooks/use-portfolios";
import { transactionKeys } from "./use-transactions";

const createTransactionOperation = findOperation(transactionOperations, "createTransaction");

/**
 * Records a transaction in a portfolio and refreshes what it changes: the pages of the list, the
 * positions and the dashboard overview. The request carries an `Idempotency-Key`, so the HTTP client may retry it and a
 * second submit of the same request cannot record it twice. The key belongs to the request, not
 * to the call: the same body keeps the key until it succeeds, so a retry after a failure with an
 * unknown outcome (a timeout, a dropped connection) returns the stored answer; a changed body gets
 * a new key, because the API answers 409 to the same key with a different request.
 */
export function useCreateTransaction(portfolioId: string) {
  const client = useTradingClient();
  const queryClient = useQueryClient();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);

  return useMutation({
    mutationKey: ["transactions", "create", portfolioId],
    mutationFn: async (body: CreateTransactionRequestBody) => {
      const fingerprint = JSON.stringify(body);
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      }
      const { data } = (await client.call(createTransactionOperation, {
        params: { portfolioId },
        body,
        idempotencyKey: attempt.current.key,
      })) as { data: CreateTransactionResponse };
      return data;
    },
    onSuccess: () => {
      attempt.current = null;
      void queryClient.invalidateQueries({ queryKey: transactionKeys.portfolio(portfolioId) });
      void queryClient.invalidateQueries({ queryKey: portfolioKeys.positions(portfolioId) });
      void queryClient.invalidateQueries({ queryKey: overviewKeys.portfolio(portfolioId) });
      void queryClient.invalidateQueries({ queryKey: performanceKeys.portfolio(portfolioId) });
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.portfolio(portfolioId) });
    },
  });
}
