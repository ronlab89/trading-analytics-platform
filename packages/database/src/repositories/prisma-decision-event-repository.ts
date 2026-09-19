import type {
  CreateDecisionEventInput,
  DecisionEvent,
  DecisionEventRepository,
} from "@trading/domain";
import { prisma } from "../client.js";
import { toDomainDecisionEvent, toPrismaCreateInput } from "../mappers/decision-event-mapper.js";

/**
 * Prisma-backed implementation of `DecisionEventRepository`.
 * No `update()`/`delete()` — see the domain contract's module comment
 * for why decision events are an immutable, append-only history.
 */
export class PrismaDecisionEventRepository implements DecisionEventRepository {
  async listByDecisionId(decisionId: string): Promise<DecisionEvent[]> {
    const rows = await prisma.decisionEvent.findMany({
      where: { decisionId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(toDomainDecisionEvent);
  }

  async create(input: CreateDecisionEventInput): Promise<DecisionEvent> {
    const row = await prisma.decisionEvent.create({ data: toPrismaCreateInput(input) });
    return toDomainDecisionEvent(row);
  }
}
