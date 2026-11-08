import { useMutation } from "@tanstack/react-query";
import { transactionOperations, type JobResponse } from "@trading/contracts";
import { useRef } from "react";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const importTransactionsOperation = findOperation(transactionOperations, "importTransactions");

/**
 * Sends a CSV to a portfolio as the raw body and returns the job the API queued (202). Nothing is
 * recorded yet, so nothing is refreshed here: the data changes when the job completes. The request
 * carries an `Idempotency-Key`, so the HTTP client may retry it and a second send of the same file
 * cannot queue two jobs. The key belongs to the content, not to the call: the same text keeps the
 * key until it succeeds, so a retry after a failure with an unknown outcome returns the stored
 * job; a different file gets a new key, because the API answers 409 to the same key with another
 * request.
 */
export function useImportCsv(portfolioId: string) {
  const client = useTradingClient();
  const attempt = useRef<{ csv: string; key: string } | null>(null);

  return useMutation({
    mutationKey: ["transactions", "import", portfolioId],
    mutationFn: async (csv: string) => {
      if (attempt.current?.csv !== csv) {
        attempt.current = { csv, key: crypto.randomUUID() };
      }
      const { data } = (await client.call(importTransactionsOperation, {
        params: { portfolioId },
        body: csv,
        idempotencyKey: attempt.current.key,
      })) as { data: JobResponse };
      return data;
    },
    onSuccess: () => {
      attempt.current = null;
    },
  });
}
