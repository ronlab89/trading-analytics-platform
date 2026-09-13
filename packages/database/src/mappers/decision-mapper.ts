import type { Decision as PrismaDecision } from "../../generated/client/index.js";
import type { CreateDecisionInput, Decision, DecisionDirection } from "@trading/domain";
import { Money } from "@trading/domain";

function toDomainDirection(direction: PrismaDecision["direction"]): DecisionDirection {
  return direction;
}

/**
 * `entryPrice`, `targetPrice` and `stopPrice` are independently nullable
 * columns sharing a single nullable `currency` column (schema.prisma).
 * `validateNewDecision` (domain) already guarantees that whichever of
 * the three prices are provided share the same currency, so reading any
 * non-null price alongside the row's `currency` is safe. A non-null
 * amount with a null currency would mean the invariant was violated
 * upstream (e.g. by a direct DB write bypassing this repository) — that
 * is treated as a data-integrity error, not silently coerced.
 */
function toMoneyOrNull(
  amount: PrismaDecision["entryPrice"],
  currency: string | null,
): Money | null {
  if (amount === null) return null;

  if (currency === null) {
    throw new Error(
      "Data integrity violation: Decision has a price but no currency. " +
        "This should be impossible if all writes go through validateNewDecision.",
    );
  }

  return Money.of(amount.toString(), currency);
}

export function toDomainDecision(row: PrismaDecision): Decision {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    assetId: row.assetId,
    title: row.title,
    thesis: row.thesis,
    direction: toDomainDirection(row.direction),
    entryPrice: toMoneyOrNull(row.entryPrice, row.currency),
    targetPrice: toMoneyOrNull(row.targetPrice, row.currency),
    stopPrice: toMoneyOrNull(row.stopPrice, row.currency),
    riskLevel: row.riskLevel,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
    outcome: row.outcome,
    notes: row.notes,
  };
}

export function toPrismaCreateInput(input: CreateDecisionInput) {
  const sharedCurrency =
    input.entryPrice?.currency ?? input.targetPrice?.currency ?? input.stopPrice?.currency;

  // Extracted to local consts: TS's control-flow narrowing does not
  // reliably propagate through `input.entryPrice !== undefined` when
  // `input.entryPrice.toString()` is re-evaluated inside a spread's
  // ternary branch on some TS versions/configurations. Narrowing a
  // local const via a shorthand property (`{ entryPrice }`) is the
  // reliable form under exactOptionalPropertyTypes.
  const entryPrice = input.entryPrice?.toString();
  const targetPrice = input.targetPrice?.toString();
  const stopPrice = input.stopPrice?.toString();

  return {
    portfolioId: input.portfolioId,
    assetId: input.assetId,
    title: input.title,
    thesis: input.thesis,
    direction: input.direction,
    ...(entryPrice !== undefined ? { entryPrice } : {}),
    ...(targetPrice !== undefined ? { targetPrice } : {}),
    ...(stopPrice !== undefined ? { stopPrice } : {}),
    ...(sharedCurrency !== undefined ? { currency: sharedCurrency } : {}),
    ...(input.riskLevel !== undefined ? { riskLevel: input.riskLevel } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}
