import type { MoneyDto } from "@trading/contracts";
import { transactionTotal } from "./transaction-total";

const DECIMAL = /^\d+(\.\d+)?$/;

interface TransactionImpactInput {
  type: string;
  /** What the form holds: text, as typed. */
  quantity: string;
  price: string;
  fees: string;
  currency: string;
  /** Units of the asset the portfolio holds now, or undefined while that is not known. */
  held: number | undefined;
}

export interface TransactionImpact {
  quantity: number;
  price: MoneyDto;
  /** Quantity times price. */
  operation: MoneyDto;
  fees: MoneyDto;
  /** A purchase costs the operation plus the fees; a sale brings in the operation minus them. */
  total: MoneyDto;
  /** The position before and after, or null while the type or the current position is unknown. */
  position: { from: number; to: number } | null;
}

const money = (cents: number, currency: string): MoneyDto => ({
  amount: (cents / 100).toFixed(2),
  currency,
});

/**
 * What a transaction would do, worked out from the form while it is filled in, for the Figma
 * "Resumen del impacto". It is null until the quantity and the price are numbers above zero, so
 * the summary never shows a half-typed value. Empty fees count as zero, as the form says, and
 * invalid fees as well: the form reports them, the summary does not guess.
 */
export function transactionImpact(input: TransactionImpactInput): TransactionImpact | null {
  if (!DECIMAL.test(input.quantity) || !DECIMAL.test(input.price)) return null;
  const quantity = Number(input.quantity);
  const unitPrice = Number(input.price);
  if (quantity <= 0 || unitPrice <= 0) return null;

  const price = { amount: input.price, currency: input.currency };
  const operation = transactionTotal(price, quantity);
  const feeCents = DECIMAL.test(input.fees) ? Math.round(Number(input.fees) * 100) : 0;
  const operationCents = Math.round(Number(operation.amount) * 100);
  const sign = input.type === "SELL" ? -1 : 1;
  const known = (input.type === "BUY" || input.type === "SELL") && input.held !== undefined;

  return {
    quantity,
    price,
    operation,
    fees: money(feeCents, input.currency),
    total: money(operationCents + sign * feeCents, input.currency),
    position: known ? { from: input.held ?? 0, to: (input.held ?? 0) + sign * quantity } : null,
  };
}
