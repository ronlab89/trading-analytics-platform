import { z } from "zod";
import { TransactionStatus, TransactionType } from "@trading/domain";
import type { Position, Transaction } from "@trading/domain";
import { positionResponseSchema, presentPosition } from "./position.response.js";
import {
  isoTimestampSchema,
  moneySchema,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";

const transactionTypeValues = Object.values(TransactionType) as [
  TransactionType,
  ...TransactionType[],
];
const transactionStatusValues = Object.values(TransactionStatus) as [
  TransactionStatus,
  ...TransactionStatus[],
];

/**
 * Response shapes for the transaction endpoints.
 * Source: 07-api-spec.md (Transactions), 05-data-model.md §9-10, FR-017/018.
 */
export const transactionResponseSchema = z.object({
  id: z.string(),
  portfolioId: z.string(),
  assetId: z.string(),
  type: z.enum(transactionTypeValues),
  quantity: z.number(),
  price: moneySchema,
  fees: moneySchema,
  status: z.enum(transactionStatusValues),
  executedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
});
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;

/** POST /portfolios/:portfolioId/transactions: the transaction plus the recalculated position. */
export const createTransactionResponseSchema = z.object({
  transaction: transactionResponseSchema,
  position: positionResponseSchema.nullable(),
});
export type CreateTransactionResponse = z.infer<typeof createTransactionResponseSchema>;

export function presentTransaction(transaction: Transaction): TransactionResponse {
  return {
    id: transaction.id,
    portfolioId: transaction.portfolioId,
    assetId: transaction.assetId,
    type: transaction.type,
    quantity: transaction.quantity,
    price: presentMoney(transaction.price),
    fees: presentMoney(transaction.fees),
    status: transaction.status,
    executedAt: presentTimestamp(transaction.executedAt),
    createdAt: presentTimestamp(transaction.createdAt),
  };
}

export function presentCreateTransactionResult(result: {
  transaction: Transaction;
  position: Position | null;
}): CreateTransactionResponse {
  return {
    transaction: presentTransaction(result.transaction),
    position: result.position ? presentPosition(result.position) : null,
  };
}
