import type { MoneyDto, TransactionResponse } from "@trading/contracts";

/**
 * What the transactions table shows of a transaction. The symbol and name are null if the asset did
 * not load, and the total is derived: the API sends the price and the fees, not their product.
 */
export interface TransactionRow {
  id: string;
  executedAt: string;
  type: TransactionResponse["type"];
  symbol: string | null;
  name: string | null;
  quantity: number;
  price: MoneyDto;
  fees: MoneyDto;
  total: MoneyDto;
  status: TransactionResponse["status"];
}
