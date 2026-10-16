import { z } from "zod";
import type { Money } from "@trading/domain";
import { paginationMetaSchema } from "./pagination.schema.js";

/**
 * Building blocks shared by every response schema and presenter.
 * Source: ADR-002 (response envelope, money as decimal strings).
 *
 * Presenters are the only place a domain value becomes wire JSON, so the
 * contract no longer depends on how a domain class happens to serialize.
 */

export const moneySchema = z.object({
  // Fixed-notation decimal string: no exponent such as "5e-8" (ADR-002 point 9).
  amount: z.string().regex(/^-?\d+(\.\d+)?$/),
  currency: z.string().length(3),
});
export type MoneyDto = z.infer<typeof moneySchema>;

export const isoTimestampSchema = z.iso.datetime();

export const archiveMetaSchema = z.object({ alreadyArchived: z.boolean() });
export type ArchiveMeta = z.infer<typeof archiveMetaSchema>;

export function dataEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export function pageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: paginationMetaSchema });
}

export function presentMoney(money: Money): MoneyDto {
  return { amount: money.toString(), currency: money.currency };
}

export function presentTimestamp(date: Date): string {
  return date.toISOString();
}
