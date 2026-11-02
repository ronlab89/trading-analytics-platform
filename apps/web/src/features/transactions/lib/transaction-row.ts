import type { TransactionResponse } from "@trading/contracts";
import type { TransactionRow } from "../types";
import { transactionTotal } from "./transaction-total";

/**
 * What a transaction looks like to the tables and cards that list it: the transaction with the
 * symbol and name of its asset and its total. The transactions list and the dashboard build their
 * rows with this, so both write the same total. An asset that is not known leaves a null symbol and
 * name instead of hiding the row.
 */
export function toTransactionRow(
  transaction: TransactionResponse,
  asset: { symbol: string; name: string } | undefined,
): TransactionRow {
  return {
    id: transaction.id,
    executedAt: transaction.executedAt,
    type: transaction.type,
    symbol: asset?.symbol ?? null,
    name: asset?.name ?? null,
    quantity: transaction.quantity,
    price: transaction.price,
    fees: transaction.fees,
    total: transactionTotal(transaction.price, transaction.quantity),
    status: transaction.status,
  };
}
