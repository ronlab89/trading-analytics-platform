import type { DecisionEvent as PrismaDecisionEvent, Prisma } from "../../generated/client/index.js";
import type { CreateDecisionEventInput, DecisionEvent, DecisionEventType } from "@trading/domain";

function toDomainType(type: PrismaDecisionEvent["type"]): DecisionEventType {
  return type;
}

/** Same Json-to-Record cast rationale as asset-mapper.ts's toDomainMetadata. */
function toDomainPayload(
  payload: PrismaDecisionEvent["payload"],
): Readonly<Record<string, unknown>> {
  return payload as Readonly<Record<string, unknown>>;
}

export function toDomainDecisionEvent(row: PrismaDecisionEvent): DecisionEvent {
  return {
    id: row.id,
    decisionId: row.decisionId,
    timestamp: row.timestamp,
    type: toDomainType(row.type),
    payload: toDomainPayload(row.payload),
  };
}

/**
 * `payload` defaults to `{}` when the caller omits it, since the column
 * is non-nullable with no database default. This is a structural
 * fallback only — it does NOT validate that a given event `type`
 * carries the payload fields that type conceptually implies (e.g. a
 * PRICE_UPDATE event with an empty payload is structurally valid here).
 * Per-type payload completeness, if ever required, belongs in
 * `validateNewDecisionEvent` (domain), not this repository.
 *
 * `timestamp` is always set here (`new Date()`) — `CreateDecisionEventInput`
 * does not expose it at all (see entities/decision-event.ts), so
 * assigning it is this repository's responsibility, same as `id`.
 */
export function toPrismaCreateInput(input: CreateDecisionEventInput) {
  return {
    decisionId: input.decisionId,
    type: input.type,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    timestamp: new Date(),
  };
}
